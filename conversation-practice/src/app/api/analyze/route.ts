// POST /api/analyze — 전체 대화록 → 지표 6종 (명세 8절).
// 분석 LLM은 대화 LLM과 분리(ANALYSIS_PROVIDER). 버전 고정 프롬프트 사용.
import { NextRequest, NextResponse } from 'next/server';
import { chat, parseJsonLoose, type Provider } from '@/lib/providers/llm';
import {
  ANALYSIS_SYSTEM,
  buildAnalysisUserPrompt,
  ANALYSIS_PROMPT_VERSION,
} from '@/lib/prompts/analysis.v1';
import type { Metrics, Responsiveness, Turn } from '@/lib/types';

export const runtime = 'nodejs';

type Body = { turns: Turn[]; responsiveness: Responsiveness };

export async function POST(req: NextRequest) {
  try {
    const { turns, responsiveness } = (await req.json()) as Body;
    if (!Array.isArray(turns)) {
      return NextResponse.json({ error: 'turns 가 없습니다.' }, { status: 400 });
    }

    const provider = (process.env.ANALYSIS_PROVIDER as Provider) || 'openai';
    const model =
      provider === 'claude'
        ? process.env.CLAUDE_ANALYSIS_MODEL || 'claude-sonnet-5'
        : process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o';

    const raw = await chat({
      provider,
      system: ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: buildAnalysisUserPrompt(turns) }],
      model,
      temperature: 0, // 회차 간 판정 안정성 (8절 주의)
      maxTokens: 2000,
      json: true,
    });

    const partial = parseJsonLoose<Partial<Metrics>>(raw);
    // responsiveness 는 코드가 채운다(세션에서 뽑은 실제 값, D2 공개).
    const metrics: Metrics = {
      followUpQuestions: partial.followUpQuestions ?? { count: 0, total: 0, items: [] },
      nonFollowUpQuestions: partial.nonFollowUpQuestions ?? [],
      layerDistribution: partial.layerDistribution ?? {
        user: { fact: 0, opinion: 0, feeling: 0, value: 0 },
        persona: { fact: 0, opinion: 0, feeling: 0, value: 0 },
      },
      openedFirst: partial.openedFirst ?? { count: 0, attempts: 0, items: [] },
      speechRatio: partial.speechRatio ?? { user: 0, persona: 0 },
      deepestLayer: partial.deepestLayer ?? { layer: 'fact', atTurn: 0 },
      responsiveness,
      agreementRate: partial.agreementRate ?? 0,
    };

    return NextResponse.json({ metrics, promptVersion: ANALYSIS_PROMPT_VERSION });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '분석 실패' }, { status: 500 });
  }
}
