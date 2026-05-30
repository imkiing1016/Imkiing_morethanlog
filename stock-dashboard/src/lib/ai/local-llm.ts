// 로컬 LLM 클라이언트 (Ollama / OpenAI 호환 서버)
// 기본: Ollama (http://localhost:11434). API 키 불필요, 사용자 PC에서 무료 실행.
//
// 환경변수:
//   LOCAL_LLM_URL    기본 "http://localhost:11434"
//   LOCAL_LLM_MODEL  기본 "qwen2.5" (한국어 양호). llama3.1 / gemma2 등 가능
//   LOCAL_LLM_DISABLED  "1" 이면 로컬 LLM 사용 안 함(휴리스틱/mock만)

const LLM_URL = (process.env.LOCAL_LLM_URL ?? "http://localhost:11434").replace(/\/$/, "");
const LLM_MODEL = process.env.LOCAL_LLM_MODEL ?? "qwen2.5";

export function isLocalLlmEnabled(): boolean {
  return process.env.LOCAL_LLM_DISABLED !== "1";
}

interface LocalLlmOptions {
  timeoutMs?: number;
  /** JSON 출력 강제 (Ollama format:"json") */
  json?: boolean;
  temperature?: number;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

/**
 * 로컬 LLM에 system+user 프롬프트를 보내고 응답 텍스트를 반환.
 * Ollama /api/chat 사용. 실패 시 throw (호출부에서 휴리스틱/mock으로 폴백).
 */
export async function localLlmChat(
  system: string,
  user: string,
  opts: LocalLlmOptions = {},
): Promise<string> {
  if (!isLocalLlmEnabled()) throw new Error("local LLM disabled");
  const url = `${LLM_URL}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      stream: false,
      ...(opts.json ? { format: "json" } : {}),
      options: { temperature: opts.temperature ?? 0.3 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Local LLM ${res.status}`);
  const json = (await res.json()) as OllamaChatResponse;
  const content = json.message?.content;
  if (!content) throw new Error("Local LLM: empty response");
  return content;
}

export function localLlmModelName(): string {
  return LLM_MODEL;
}
