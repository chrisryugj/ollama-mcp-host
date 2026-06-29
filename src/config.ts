import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { HostConfig } from "./types.js";

/**
 * mcp.config.json 을 읽어 HostConfig 로 만든다.
 *
 * - ${ENV} 형태의 문자열은 환경변수로 치환한다 (예: LAW_OC 키를 설정파일에
 *   하드코딩하지 않고 "${LAW_OC}" 로 두면 실행 시 process.env 에서 읽음).
 * - 서버의 args/cwd 의 상대경로는 설정파일 위치 기준으로 절대경로화한다.
 */
export function loadConfig(path: string): HostConfig {
  const abs = resolve(process.cwd(), path);
  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch (err) {
    throw new Error(`설정 파일을 읽을 수 없습니다: ${abs} (${(err as Error).message})`);
  }

  let parsed: HostConfig;
  try {
    parsed = JSON.parse(expandEnv(raw)) as HostConfig;
  } catch (err) {
    throw new Error(`설정 파일 JSON 파싱 실패: ${abs} (${(err as Error).message})`);
  }

  validate(parsed, abs);

  const baseDir = dirname(abs);
  for (const s of parsed.servers) {
    if (s.cwd) s.cwd = resolve(baseDir, s.cwd);
  }
  return parsed;
}

/** ${VAR} 를 process.env[VAR] 로 치환. 없는 변수는 빈 문자열. */
function expandEnv(text: string): string {
  return text.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
    const v = process.env[name];
    if (v === undefined) {
      console.error(`경고: 환경변수 ${name} 가 설정되지 않아 빈 값으로 치환합니다.`);
      return "";
    }
    // JSON 문자열 안에 들어가므로 따옴표/역슬래시를 이스케이프
    return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  });
}

function validate(cfg: HostConfig, path: string): void {
  if (!cfg.model || typeof cfg.model !== "string") {
    throw new Error(`${path}: "model" (Ollama 모델 태그) 가 필요합니다. 예: "gemma4:e4b"`);
  }
  if (!Array.isArray(cfg.servers) || cfg.servers.length === 0) {
    throw new Error(`${path}: "servers" 배열에 MCP 서버를 최소 1개 등록해야 합니다.`);
  }
  const names = new Set<string>();
  for (const s of cfg.servers) {
    if (!s.name) throw new Error(`${path}: 각 서버에 "name" 이 필요합니다.`);
    if (!s.command) throw new Error(`${path}: 서버 '${s.name}' 에 "command" 가 필요합니다.`);
    if (names.has(s.name)) throw new Error(`${path}: 서버 이름 '${s.name}' 이 중복됩니다.`);
    names.add(s.name);
  }
}
