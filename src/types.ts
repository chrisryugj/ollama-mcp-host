/** Ollama /api/chat 의 tool 정의 (OpenAI 호환 함수 스키마) */
export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

/** Ollama 가 돌려주는 tool_call */
export interface OllamaToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
}

/** /api/chat 메시지 */
export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** thinking 모델이 채워주는 추론 텍스트 (assistant 응답에만) */
  thinking?: string;
  tool_calls?: OllamaToolCall[];
  /** role:"tool" 일 때 어떤 호출에 대한 결과인지 */
  tool_name?: string;
}

/** MCP 서버 한 개 등록 정보 (stdio) */
export interface McpServerConfig {
  /** 표시·라우팅용 식별자 (예: "law", "kordoc") */
  name: string;
  /** 실행 커맨드 (예: "node") */
  command: string;
  /** 인자 (예: ["build/index.js"]) */
  args?: string[];
  /** 추가 환경변수 (예: { LAW_OC: "..." }) — process.env 위에 머지된다 */
  env?: Record<string, string>;
  /** 작업 디렉토리 */
  cwd?: string;
}

/** 호스트 전체 설정 */
export interface HostConfig {
  /** Ollama 모델 태그 (예: "gemma4:e4b") */
  model: string;
  /** Ollama 서버 주소 (기본 http://localhost:11434) */
  ollamaHost?: string;
  /** 시스템 프롬프트 */
  system?: string;
  /** 등록할 MCP 서버들 */
  servers: McpServerConfig[];
  /** tool-call 왕복 최대 횟수 (무한루프 방지, 기본 8) */
  maxToolRounds?: number;
}
