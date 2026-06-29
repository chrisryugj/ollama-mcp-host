import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ollamaChat, modelSupportsTools } from "./ollama.js";
import { normalizeSchema, parseArgs, extractText, cleanEnv } from "./util.js";
import type {
  HostConfig,
  McpServerConfig,
  OllamaMessage,
  OllamaTool,
  OllamaToolCall,
} from "./types.js";

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";
const DEFAULT_MAX_ROUNDS = 8;

/** 호스트가 처리 도중 내보내는 진행 이벤트 (CLI 가 화면에 출력) */
export interface HostEvents {
  onToolCall?: (info: { server: string; tool: string; args: unknown }) => void;
  onToolResult?: (info: { tool: string; preview: string; isError: boolean }) => void;
  /** 모델이 도구를 안 부르고 그냥 답할 때 호출 (스트리밍 대용 알림) */
  onAssistantText?: (text: string) => void;
}

interface RegisteredTool {
  /** 모델에 노출되는 이름 (충돌 시 prefix 적용) */
  exposedName: string;
  /** MCP 서버에서의 실제 도구 이름 */
  realName: string;
  server: ConnectedServer;
  description: string;
  /** Ollama 에 넘길 JSON Schema (object) */
  parameters: Record<string, unknown>;
}

interface ConnectedServer {
  name: string;
  client: Client;
  transport: StdioClientTransport;
}

/**
 * 여러 MCP 서버를 하나의 Ollama 모델에 물려주는 호스트.
 *
 * 1) connect(): 모든 stdio MCP 서버를 띄우고 도구 목록을 수집해 Ollama tool 스키마로 변환
 * 2) chat(): 모델에 도구를 넘기고, tool_call 이 나오면 해당 서버로 라우팅해 실행,
 *    결과를 다시 컨텍스트에 넣어 도구 호출이 멈출 때까지 반복
 */
export class McpHost {
  private readonly config: HostConfig;
  private readonly ollamaHost: string;
  private readonly maxRounds: number;
  private servers: ConnectedServer[] = [];
  private tools: RegisteredTool[] = [];
  private ollamaTools: OllamaTool[] = [];

  constructor(config: HostConfig) {
    this.config = config;
    this.ollamaHost = config.ollamaHost ?? DEFAULT_OLLAMA_HOST;
    this.maxRounds = config.maxToolRounds ?? DEFAULT_MAX_ROUNDS;
  }

  /** 등록된 MCP 서버를 모두 띄우고 도구를 수집한다 */
  async connect(): Promise<void> {
    for (const sc of this.config.servers) {
      const server = await this.connectServer(sc);
      this.servers.push(server);
      const { tools } = await server.client.listTools();
      for (const t of tools) {
        this.registerTool(server, t.name, t.description, t.inputSchema);
      }
    }
    this.ollamaTools = this.tools.map((rt) => ({
      type: "function",
      function: {
        name: rt.exposedName,
        description: describeTool(rt),
        parameters: rt.parameters,
      },
    }));
  }

  private async connectServer(sc: McpServerConfig): Promise<ConnectedServer> {
    const transport = new StdioClientTransport({
      command: sc.command,
      args: sc.args ?? [],
      cwd: sc.cwd,
      // process.env 위에 서버별 env 를 머지 (undefined 값 제거)
      env: cleanEnv({ ...process.env, ...(sc.env ?? {}) }),
    });
    const client = new Client(
      { name: "ollama-mcp-host", version: "0.1.0" },
      { capabilities: {} }
    );
    try {
      await client.connect(transport);
    } catch (err) {
      throw new Error(
        `MCP 서버 '${sc.name}' (${sc.command} ${(sc.args ?? []).join(" ")}) 연결 실패: ${
          (err as Error).message
        }`
      );
    }
    return { name: sc.name, client, transport };
  }

  private registerTool(
    server: ConnectedServer,
    realName: string,
    description: string | undefined,
    inputSchema: unknown
  ): void {
    // 이미 같은 이름이 있으면 두 도구 모두 server prefix 로 노출해 충돌 회피
    const clash = this.tools.find((t) => t.exposedName === realName);
    let exposedName = realName;
    if (clash) {
      clash.exposedName = `${clash.server.name}__${clash.realName}`;
      exposedName = `${server.name}__${realName}`;
    }
    this.tools.push({
      exposedName,
      realName,
      server,
      description: description ?? "",
      parameters: normalizeSchema(inputSchema),
    });
  }

  /** Ollama 에 넘길 도구 스키마 (디버깅·외부 노출용) */
  get exposedTools(): OllamaTool[] {
    return this.ollamaTools;
  }

  get serverNames(): string[] {
    return this.servers.map((s) => s.name);
  }

  /** 모델이 tools capability 를 갖는지 확인 (없으면 도구 호출 불가) */
  async checkModelToolSupport(): Promise<boolean> {
    return modelSupportsTools(this.ollamaHost, this.config.model);
  }

  /**
   * 한 턴의 대화. 주어진 messages 에 user 입력이 이미 들어있다고 가정하고,
   * 도구 호출이 끝날 때까지 돌린 뒤 갱신된 전체 messages 를 반환한다.
   */
  async chat(messages: OllamaMessage[], events: HostEvents = {}): Promise<OllamaMessage[]> {
    const convo = [...messages];

    for (let round = 0; round < this.maxRounds; round++) {
      const { message } = await ollamaChat({
        host: this.ollamaHost,
        model: this.config.model,
        messages: convo,
        tools: this.ollamaTools,
      });
      convo.push(message);

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        if (message.content) events.onAssistantText?.(message.content);
        return convo;
      }

      for (const call of calls) {
        const result = await this.dispatch(call, events);
        convo.push({
          role: "tool",
          tool_name: call.function.name,
          content: result,
        });
      }
    }

    // 라운드 소진: 모델에 도구 없이 마무리를 요청
    const { message } = await ollamaChat({
      host: this.ollamaHost,
      model: this.config.model,
      messages: [
        ...convo,
        {
          role: "user",
          content:
            "도구 호출이 너무 많아졌습니다. 지금까지 모은 정보만으로 한국어로 최종 답을 정리해 주세요.",
        },
      ],
    });
    convo.push(message);
    if (message.content) events.onAssistantText?.(message.content);
    return convo;
  }

  /** tool_call 하나를 해당 MCP 서버로 라우팅해 실행하고 텍스트 결과를 돌려준다 */
  private async dispatch(call: OllamaToolCall, events: HostEvents): Promise<string> {
    const name = call.function.name;
    const rt = this.tools.find((t) => t.exposedName === name);
    const args = parseArgs(call.function.arguments);

    if (!rt) {
      return `오류: '${name}' 라는 도구를 찾을 수 없습니다.`;
    }

    events.onToolCall?.({ server: rt.server.name, tool: rt.realName, args });

    try {
      const res = (await rt.server.client.callTool({
        name: rt.realName,
        arguments: args,
      })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

      const text = extractText(res.content);
      events.onToolResult?.({
        tool: rt.realName,
        preview: text.slice(0, 200),
        isError: !!res.isError,
      });
      return text || "(도구가 빈 결과를 반환했습니다.)";
    } catch (err) {
      const msg = `도구 '${rt.realName}' 실행 오류: ${(err as Error).message}`;
      events.onToolResult?.({ tool: rt.realName, preview: msg, isError: true });
      return msg;
    }
  }

  /** 모든 MCP 서버 종료 */
  async close(): Promise<void> {
    await Promise.allSettled(this.servers.map((s) => s.client.close()));
    this.servers = [];
  }
}

// --- helpers ---

function describeTool(rt: RegisteredTool): string {
  const base = rt.description || rt.realName;
  // 어느 서버 소속인지 모델이 알 수 있도록 꼬리표를 단다
  return `[${rt.server.name}] ${base}`;
}
