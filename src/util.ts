/** MCP inputSchema 를 Ollama parameters(JSON Schema object) 로 정규화 */
export function normalizeSchema(schema: unknown): Record<string, unknown> {
  if (schema && typeof schema === "object") {
    const s = schema as Record<string, unknown>;
    if (s.type === "object") return s;
    // type 누락 시 object 로 감싸 준다
    return { type: "object", properties: s.properties ?? {}, ...s };
  }
  return { type: "object", properties: {} };
}

/** tool_call 의 arguments 를 객체로 정규화 (문자열 JSON 도 허용) */
export function parseArgs(raw: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof raw === "string") {
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

/** MCP tool 결과 content 배열에서 텍스트를 추출 */
export function extractText(content?: Array<{ type: string; text?: string }>): string {
  if (!content) return "";
  return content
    .map((c) => (c.type === "text" ? c.text ?? "" : `[${c.type} content]`))
    .filter(Boolean)
    .join("\n");
}

/** undefined 값을 제거해 stdio transport 의 env 로 쓸 수 있게 한다 */
export function cleanEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
