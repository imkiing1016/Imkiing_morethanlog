// 로컬 LLM 클라이언트 (OpenAI 호환 API)
// LM Studio / Ollama / llama.cpp 등 OpenAI 호환 서버를 지원.
// API 키 불필요(또는 더미), 사용자 PC에서 무료 실행.
//
// 환경변수:
//   LOCAL_LLM_URL    OpenAI 호환 베이스 URL.
//                    기본 "http://localhost:1234/v1" (LM Studio)
//                    Ollama 사용 시: "http://localhost:11434/v1"
//   LOCAL_LLM_MODEL  모델 ID. 기본 "local-model"
//                    (LM Studio: 로드한 모델명 / Ollama: 예 "qwen2.5")
//   LOCAL_LLM_API_KEY  선택. LM Studio는 불필요(더미 허용)
//   LOCAL_LLM_DISABLED "1" 이면 로컬 LLM 사용 안 함(휴리스틱/mock만)

const LLM_URL = (process.env.LOCAL_LLM_URL ?? "http://localhost:1234/v1").replace(/\/$/, "");
const LLM_MODEL = process.env.LOCAL_LLM_MODEL ?? "local-model";
const LLM_API_KEY = process.env.LOCAL_LLM_API_KEY ?? "lm-studio";

export function isLocalLlmEnabled(): boolean {
  return process.env.LOCAL_LLM_DISABLED !== "1";
}

interface LocalLlmOptions {
  timeoutMs?: number;
  /** JSON 출력 강제 (response_format: json_object) */
  json?: boolean;
  temperature?: number;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * 로컬 LLM(OpenAI 호환)에 system+user 프롬프트를 보내고 응답 텍스트를 반환.
 * POST {LLM_URL}/chat/completions 사용. 실패 시 throw (호출부에서 휴리스틱/mock 폴백).
 */
export async function localLlmChat(
  system: string,
  user: string,
  opts: LocalLlmOptions = {},
): Promise<string> {
  if (!isLocalLlmEnabled()) throw new Error("local LLM disabled");
  const res = await fetch(`${LLM_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      stream: false,
      temperature: opts.temperature ?? 0.3,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Local LLM ${res.status}`);
  const json = (await res.json()) as OpenAIChatResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Local LLM: empty response");
  return content;
}

export function localLlmModelName(): string {
  return LLM_MODEL;
}
