// POST /api/persona — 세션 시작 시 페르소나 생성 + 반응성 확률 추출.
// 명세 10절, D2(사용자에게 미리 알리지 않는다 → 클라이언트가 종료 전까지 숨김).
import { NextRequest, NextResponse } from 'next/server';
import { pickScenario } from '@/lib/scenarios';
import {
  drawResponsiveness,
  buildPersonaGenPrompt,
  fallbackPersona,
} from '@/lib/persona';
import { chat, parseJsonLoose, type Provider } from '@/lib/providers/llm';
import type { Persona } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { scenarioId } = await req.json();
    const scenario = pickScenario(scenarioId ?? 'random');
    const responsiveness = drawResponsiveness();

    let persona: Persona;
    const provider = (process.env.CONVERSATION_PROVIDER as Provider) || 'claude';
    const hasKey =
      provider === 'claude' ? !!process.env.ANTHROPIC_API_KEY : !!process.env.OPENAI_API_KEY;

    if (hasKey) {
      try {
        const raw = await chat({
          provider,
          system: '너는 대화 연습 앱을 위한 캐릭터 설계자다. 요청한 JSON만 출력한다.',
          messages: [{ role: 'user', content: buildPersonaGenPrompt(scenario, responsiveness) }],
          temperature: 1.0,
          maxTokens: 800,
          json: true,
        });
        persona = parseJsonLoose<Persona>(raw);
        if (!Array.isArray(persona.opennessReserve)) persona.opennessReserve = [];
      } catch {
        persona = fallbackPersona();
      }
    } else {
      persona = fallbackPersona();
    }

    return NextResponse.json({ scenario, persona, responsiveness });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'persona 생성 실패' }, { status: 500 });
  }
}
