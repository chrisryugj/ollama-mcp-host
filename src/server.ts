import { createServer, type IncomingMessage, type Server } from "node:http";
import type { McpHost } from "./host.js";
import type { HostConfig, OllamaMessage } from "./types.js";

export interface ServeOptions {
  port?: number;
  host?: string;
}

/**
 * McpHost 를 가벼운 HTTP API 로 띄운다 (Node 내장 http — 추가 의존성 없음).
 *
 *   GET  /health           → 상태/모델/도구 수
 *   GET  /tools            → 노출 도구 목록
 *   POST /chat  {message}  → 단발 질문 (stateless). 응답: {answer, toolCalls}
 *   POST /chat  {messages} → 멀티턴: 직전까지의 대화 배열을 그대로 전달
 *
 * host 는 호출 측에서 미리 connect() 된 상태여야 한다.
 */
export function startServer(
  host: McpHost,
  config: HostConfig,
  opts: ServeOptions = {}
): Promise<Server> {
  const port = opts.port ?? 8080;
  const bind = opts.host ?? "0.0.0.0";

  const server = createServer((req, res) => {
    void handle(req, res, host, config);
  });

  return new Promise((resolve) => {
    server.listen(port, bind, () => {
      console.error(`HTTP API listening on http://${bind}:${port}  (POST /chat, GET /health, GET /tools)`);
      resolve(server);
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: import("node:http").ServerResponse,
  host: McpHost,
  config: HostConfig
): Promise<void> {
  const send = (code: number, obj: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  try {
    const url = (req.url ?? "").split("?")[0];

    if (req.method === "GET" && url === "/health") {
      return send(200, {
        status: "ok",
        model: config.model,
        servers: host.serverNames,
        tools: host.exposedTools.length,
      });
    }

    if (req.method === "GET" && url === "/tools") {
      return send(200, {
        tools: host.exposedTools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
        })),
      });
    }

    if (req.method === "POST" && url === "/chat") {
      const raw = await readBody(req);
      let data: { message?: string; messages?: OllamaMessage[] };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        return send(400, { error: "본문이 올바른 JSON 이 아닙니다." });
      }

      const messages = buildMessages(data, config);
      if (messages.length === 0) {
        return send(400, { error: 'message(문자열) 또는 messages(배열) 가 필요합니다. 예: {"message":"도로교통법 알려줘"}' });
      }

      const toolCalls: Array<{ server: string; tool: string; args: unknown }> = [];
      const updated = await host.chat(messages, {
        onToolCall: (i) => toolCalls.push({ server: i.server, tool: i.tool, args: i.args }),
      });
      const last = updated[updated.length - 1];
      return send(200, {
        answer: last?.content ?? "",
        toolCalls,
        messages: updated,
      });
    }

    send(404, {
      error: "Not found. 사용 가능: GET /health, GET /tools, POST /chat {message}",
    });
  } catch (err) {
    send(500, { error: (err as Error).message });
  }
}

/** 요청 본문을 문자열로 읽는다 (1MB 상한) */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error("요청 본문이 너무 큽니다 (1MB 초과)."));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** {message} 또는 {messages} 입력을 대화 배열로 정규화 (system 프롬프트 보장) */
function buildMessages(
  data: { message?: string; messages?: OllamaMessage[] },
  config: HostConfig
): OllamaMessage[] {
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    const hasSystem = data.messages.some((m) => m.role === "system");
    return hasSystem || !config.system
      ? data.messages
      : [{ role: "system", content: config.system }, ...data.messages];
  }
  if (typeof data.message === "string" && data.message.trim()) {
    const out: OllamaMessage[] = [];
    if (config.system) out.push({ role: "system", content: config.system });
    out.push({ role: "user", content: data.message });
    return out;
  }
  return [];
}
