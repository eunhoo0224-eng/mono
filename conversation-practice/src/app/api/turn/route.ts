// POST /api/turn — 대화 이력 → 페르소나 응답(텍스트) + 아첨 게이트 + TTS(오디오).
// 명세 5절 파이프라인의 [서버] 구간. 9절 게이트를 응답과 TTS 사이에 둔다.
import { NextRequest, NextResponse } from 'next/server';
import { generateReply } from '@/lib/server/reply';
import { synthesize } from '@/lib/providers/tts';
import type { Persona, Responsiveness, Scenario, Turn } from '@/lib/types';

export const runtime = 'nodejs';

type Body = {
  scenario: Scenario;
  persona: Persona;
  responsiveness: Responsiveness;
  turns: Turn[];
  closing?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.persona || !body?.scenario || !Array.isArray(body.turns)) {
      return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
    }

    const reply = await generateReply({
      scenario: body.scenario,
      persona: body.persona,
      responsiveness: body.responsiveness,
      turns: body.turns,
      closing: body.closing,
    });

    // TTS. 실패해도 텍스트는 반환(클라이언트 SpeechSynthesis 폴백).
    let audioBase64: string | null = null;
    let audioMime: string | null = null;
    try {
      const tts = await synthesize(reply.text, body.persona);
      if (tts) {
        audioBase64 = tts.audio.toString('base64');
        audioMime = tts.mime;
      }
    } catch (e) {
      // 무음 처리 — 클라이언트가 브라우저 음성으로 대체.
      audioBase64 = null;
    }

    return NextResponse.json({
      text: reply.text,
      sycophancyRetries: reply.sycophancyRetries,
      regexFlaggedFinal: reply.regexFlaggedFinal,
      audioBase64,
      audioMime,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'turn 실패' }, { status: 500 });
  }
}
