// 대화 응답 생성 + 아첨 게이트 (명세 9절 ⑤). TTS 이전 단계까지.
// /api/turn 과 아첨 회귀 테스트가 공유한다.
import { chat, parseJsonLoose, type ChatMessage, type Provider } from '../providers/llm';
import { looksSycophantic } from '../sycophancy';
import { buildConversationSystemPrompt } from '../prompts/conversation';
import { SYCOPHANCY_JUDGE_SYSTEM, buildJudgeUserPrompt } from '../prompts/sycophancy-judge';
import type { Persona, Responsiveness, Scenario, Turn } from '../types';

function convProvider(): Provider {
  return (process.env.CONVERSATION_PROVIDER as Provider) || 'claude';
}
function judgeProvider(): Provider {
  return (process.env.JUDGE_PROVIDER as Provider) || 'claude';
}

// 대화 이력(turns) → LLM 메시지 배열. 페르소나=assistant, 사용자=user.
function toMessages(turns: Turn[]): ChatMessage[] {
  return turns.map((t) => ({
    role: t.speaker === 'user' ? 'user' : 'assistant',
    content: t.text,
  }));
}

// 2차 게이트: 경량 LLM 판정. 실패(키 없음/에러) 시 아첨 아님으로 간주(1차만 신뢰).
async function judgeSycophancy(userLast: string, candidate: string): Promise<boolean> {
  try {
    const raw = await chat({
      provider: judgeProvider(),
      system: SYCOPHANCY_JUDGE_SYSTEM,
      messages: [{ role: 'user', content: buildJudgeUserPrompt(userLast, candidate) }],
      model:
        judgeProvider() === 'claude'
          ? process.env.CLAUDE_JUDGE_MODEL || 'claude-haiku-4-5-20251001'
          : process.env.OPENAI_JUDGE_MODEL || 'gpt-4o-mini',
      maxTokens: 200,
      temperature: 0,
      json: true,
    });
    const parsed = parseJsonLoose<{ sycophantic?: boolean }>(raw);
    return parsed.sycophantic === true;
  } catch {
    return false;
  }
}

export type ReplyInput = {
  scenario: Scenario;
  persona: Persona;
  responsiveness: Responsiveness;
  turns: Turn[]; // 지금까지의 전체 이력 (마지막은 user 턴)
  closing?: boolean; // true 면 이번 응답에서 자연스럽게 자리를 정리 (10절)
};

export type ReplyResult = {
  text: string;
  sycophancyRetries: number;
  /** 최종 응답이 아직도 정규식에 걸리는지(2회 실패 시 발생 가능). 관측용. */
  regexFlaggedFinal: boolean;
};

// 명세 9절 ⑤: 정규식 1차 → 경량 LLM 2차 → 걸리면 재생성(최대 2회) →
// 2회 모두 실패면 후보 중 "가장 짧은 응답" 채택.
export async function generateReply(input: ReplyInput): Promise<ReplyResult> {
  const { scenario, persona, responsiveness, turns } = input;
  let system = buildConversationSystemPrompt(scenario, persona, responsiveness);
  if (input.closing) {
    system +=
      '\n\n[지금은 대화를 마무리할 때다] 이번 답에서 자연스럽게 자리를 정리해라. "아 슬슬 가봐야겠다" 처럼, 갑작스럽지 않게. 여전히 1~2문장.';
  }
  // 대화 API 는 첫 메시지가 user 여야 한다. 페르소나가 먼저 말하는 오프닝이면
  // 이력이 비었거나 assistant 로 시작하므로, 저장되지 않는 임시 시드를 앞에 붙인다.
  const rawMessages = toMessages(turns);
  const messages: ChatMessage[] =
    rawMessages.length === 0 || rawMessages[0].role === 'assistant'
      ? [{ role: 'user', content: '(상황이 시작됐다. 자연스럽게 먼저 말을 연다.)' }, ...rawMessages]
      : rawMessages;
  const userLast = [...turns].reverse().find((t) => t.speaker === 'user')?.text ?? '';

  const candidates: string[] = [];
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const text = await chat({
      provider: convProvider(),
      system,
      messages,
      // 재생성 시 온도를 조금 올려 다른 응답을 유도.
      temperature: 0.7 + attempt * 0.15,
      maxTokens: 300,
    });
    candidates.push(text);

    const regex = looksSycophantic(text);
    if (regex.flagged) continue; // 1차 탈락 → 재생성

    const judged = await judgeSycophancy(userLast, text);
    if (judged) continue; // 2차 탈락 → 재생성

    // 통과
    return { text, sycophancyRetries: attempt, regexFlaggedFinal: false };
  }

  // 2회 모두 실패: 가장 짧은 응답 채택 (아첨할 공간이 가장 적음).
  const shortest = candidates.reduce((a, b) => (b.length < a.length ? b : a));
  return {
    text: shortest,
    sycophancyRetries: MAX_RETRIES,
    regexFlaggedFinal: looksSycophantic(shortest).flagged,
  };
}
