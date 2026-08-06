// LLM 프로바이더 추상화 — Claude / OpenAI 를 하나의 chat 인터페이스로.
// SDK 없이 REST fetch (의존성 최소화). 서버에서만 호출된다(키 보호).

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Provider = 'claude' | 'openai';

export type ChatOptions = {
  provider: Provider;
  system: string;
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** true 면 JSON 출력 유도 (OpenAI response_format). */
  json?: boolean;
};

function env(name: string, fallback?: string): string {
  return process.env[name] ?? fallback ?? '';
}

async function callClaude(o: ChatOptions): Promise<string> {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY 가 없습니다.');
  const model = o.model || env('CLAUDE_CONVERSATION_MODEL', 'claude-sonnet-5');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: o.maxTokens ?? 1024,
      temperature: o.temperature ?? 0.8,
      system: o.system,
      messages: o.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const text = (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim();
  return text;
}

async function callOpenAI(o: ChatOptions): Promise<string> {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY 가 없습니다.');
  const model = o.model || env('OPENAI_CONVERSATION_MODEL', 'gpt-4o');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: o.maxTokens ?? 1024,
      temperature: o.temperature ?? 0.8,
      messages: [{ role: 'system', content: o.system }, ...o.messages],
      ...(o.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

export async function chat(o: ChatOptions): Promise<string> {
  return o.provider === 'claude' ? callClaude(o) : callOpenAI(o);
}

// JSON 응답을 안전하게 파싱 — 코드펜스나 잡텍스트가 섞여도 첫 { } 블록을 추출.
export function parseJsonLoose<T = any>(raw: string): T {
  const fenced = raw.replace(/```json\s*|\s*```/g, '').trim();
  try {
    return JSON.parse(fenced) as T;
  } catch {
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(fenced.slice(start, end + 1)) as T;
    }
    throw new Error(`JSON 파싱 실패: ${raw.slice(0, 200)}`);
  }
}
