#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { McpHost } from "./host.js";
import { loadConfig } from "./config.js";
import type { OllamaMessage } from "./types.js";

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

interface CliArgs {
  config: string;
  model?: string;
  once?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { config: "mcp.config.json", help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-c" || a === "--config") args.config = argv[++i];
    else if (a === "-m" || a === "--model") args.model = argv[++i];
    else if (a === "--once") args.once = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

const HELP = `
ollama-mcp-host — 로컬 Ollama 모델로 여러 MCP 서버를 한꺼번에 돌리는 호스트

사용법:
  ollama-mcp-host [옵션]

옵션:
  -c, --config <path>   MCP 설정 파일 (기본: mcp.config.json)
  -m, --model <tag>     설정의 model 을 덮어씀 (예: gemma4:e4b)
  --once <질문>          대화형 대신 질문 하나만 처리하고 종료
  -h, --help            이 도움말

대화 중 명령:
  /tools   등록된 도구 목록
  /exit    종료
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const config = loadConfig(args.config);
  if (args.model) config.model = args.model;

  console.error(C.dim(`설정: ${args.config} · 모델: ${config.model}`));
  const host = new McpHost(config);

  console.error(C.dim("MCP 서버 연결 중..."));
  await host.connect();
  console.error(
    C.green(
      `연결됨: ${host.serverNames.join(", ")} · 도구 ${host.exposedTools.length}개`
    )
  );

  const supportsTools = await host.checkModelToolSupport();
  if (!supportsTools) {
    console.error(
      C.yellow(
        `경고: 모델 '${config.model}' 이 tools capability 를 보고하지 않습니다. ` +
          `도구 호출이 안 될 수 있습니다. (ollama show ${config.model} 로 확인)`
      )
    );
  }

  const messages: OllamaMessage[] = [];
  if (config.system) messages.push({ role: "system", content: config.system });

  const events = {
    onToolCall: (i: { server: string; tool: string; args: unknown }) =>
      console.error(
        C.cyan(`  ↳ [${i.server}] ${i.tool}(`) +
          C.dim(JSON.stringify(i.args)) +
          C.cyan(")")
      ),
    onToolResult: (i: { tool: string; preview: string; isError: boolean }) =>
      console.error(
        i.isError
          ? C.red(`  ✗ ${i.tool}: ${i.preview}`)
          : C.dim(`  ✓ ${i.tool}: ${i.preview.replace(/\s+/g, " ")}…`)
      ),
  };

  async function ask(question: string): Promise<void> {
    messages.push({ role: "user", content: question });
    const updated = await host.chat(messages, events);
    messages.length = 0;
    messages.push(...updated);
    const last = updated[updated.length - 1];
    console.log("\n" + C.bold(C.green("답변:")) + " " + (last?.content ?? "(빈 응답)") + "\n");
  }

  // --once: 단발 처리 후 종료 (스크립트·테스트용)
  if (args.once !== undefined) {
    try {
      await ask(args.once);
    } finally {
      await host.close();
    }
    return;
  }

  // 대화형 루프
  console.error(C.dim("\n질문을 입력하세요. /tools 도구목록 · /exit 종료\n"));
  const rl = readline.createInterface({ input: stdin, output: stdout });
  rl.on("SIGINT", () => {
    rl.close();
  });

  try {
    while (true) {
      const line = (await rl.question(C.bold("> "))).trim();
      if (!line) continue;
      if (line === "/exit") break;
      if (line === "/tools") {
        for (const t of host.exposedTools) {
          console.log(`  ${C.cyan(t.function.name)} — ${t.function.description ?? ""}`);
        }
        continue;
      }
      try {
        await ask(line);
      } catch (err) {
        console.error(C.red(`오류: ${(err as Error).message}`));
      }
    }
  } finally {
    rl.close();
    await host.close();
  }
}

main().catch((err) => {
  console.error(`\x1b[31m치명적 오류: ${err.message}\x1b[0m`);
  process.exit(1);
});
