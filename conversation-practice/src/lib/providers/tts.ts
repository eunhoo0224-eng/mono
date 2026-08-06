// TTS 프로바이더 — 명세 R-F. 서버에서 텍스트 → 오디오(mp3 bytes).
// openai(기본) / elevenlabs(품질 우선) / none(클라이언트 SpeechSynthesis 폴백).
import type { Persona } from '../types';

export type TtsProvider = 'openai' | 'elevenlabs' | 'none';

export function ttsProvider(): TtsProvider {
  return (process.env.TTS_PROVIDER as TtsProvider) || 'openai';
}

// 페르소나 성별로 보이스를 고른다 (페르소나마다 다른 목소리 — R-F).
function openaiVoice(persona: Persona): string {
  const female = ['nova', 'shimmer', 'coral'];
  const male = ['onyx', 'echo', 'ballad'];
  const isFemale = /여/.test(persona.gender);
  const pool = isFemale ? female : male;
  // 나이로 살짝 흔들어 페르소나별로 고정된 목소리 느낌.
  return pool[persona.age % pool.length];
}

export type TtsResult = { audio: Buffer; mime: string } | null;

// 반환 null = 서버 TTS 없음(클라이언트가 SpeechSynthesis 로 대체).
export async function synthesize(text: string, persona: Persona): Promise<TtsResult> {
  const provider = ttsProvider();
  if (provider === 'none') return null;

  if (provider === 'elevenlabs') {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error('ELEVENLABS_API_KEY 가 없습니다 (TTS).');
    const isFemale = /여/.test(persona.gender);
    const voice =
      (isFemale ? process.env.ELEVENLABS_VOICE_FEMALE : process.env.ELEVENLABS_VOICE_MALE) || '';
    if (!voice) throw new Error('ELEVENLABS_VOICE_FEMALE/MALE 미설정.');
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    return { audio: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' };
  }

  // openai
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY 가 없습니다 (TTS).');
  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      voice: openaiVoice(persona),
      input: text,
      response_format: 'mp3',
      // 12-4: 너무 빠르지 않게 살짝 늦춤(자연스러운 대화 속도).
      speed: 0.98,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' };
}
