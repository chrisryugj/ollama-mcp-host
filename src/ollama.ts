import type { OllamaMessage, OllamaTool } from "./types.js";

export interface OllamaChatOptions {
  host: string;
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaTool[];
  /** Ollama 옵션 (temperature 등). num_ctx 등을 여기 넣는다 */
  options?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface OllamaChatResult {
  message: OllamaMessage;
  /** 모델이 더 생성할 게 없어 정상 종료했는지 */
  done: boolean;
}

/**
 * Ollama /api/chat 단발 호출.
 *
 * 핵심: think:false 를 항상 보낸다. gemma3/gemma4 같은 thinking 지원 모델은
 * thinking 을 켜두면 추론만 길게 하고 tool_calls 를 비워서 내보내는 경우가 있다.
 * 도구 호출 신뢰성을 위해 호스트에서는 thinking 을 끈다.
 *
 * stream:false 응답이라도 thinking 텍스트에 제어문자가 섞여 JSON.parse 가
 * 까다로울 수 있어, 응답 본문을 받아 그대로 파싱한다.
 */
export async function ollamaChat(opts: OllamaChatOptions): Promise<OllamaChatResult> {
  const url = `${opts.host.replace(/\/$/, "")}/api/chat`;
  const body = {
    model: opts.model,
    messages: opts.messages,
    tools: opts.tools && opts.tools.length > 0 ? opts.tools : undefined,
    stream: false,
    think: false,
    options: opts.options,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    throw new Error(
      `Ollama 연결 실패 (${url}). 'ollama serve' 가 떠 있는지 확인하세요. 원인: ${
        (err as Error).message
      }`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    message?: OllamaMessage;
    done?: boolean;
    error?: string;
  };

  if (data.error) {
    throw new Error(`Ollama 오류: ${data.error}`);
  }
  if (!data.message) {
    throw new Error("Ollama 응답에 message 가 없습니다.");
  }

  return { message: data.message, done: data.done ?? true };
}

/** 모델 태그가 tools capability 를 가지는지 확인 (있으면 true) */
export async function modelSupportsTools(host: string, model: string): Promise<boolean> {
  const url = `${host.replace(/\/$/, "")}/api/show`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { capabilities?: string[] };
    return Array.isArray(data.capabilities) && data.capabilities.includes("tools");
  } catch {
    return false;
  }
}
