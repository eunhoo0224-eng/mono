// 클라이언트 → 서버 라우트 호출 헬퍼.
import type { Metrics, Persona, Responsiveness, Scenario, Turn } from '@/lib/types';

export async function fetchPersona(scenarioId: string): Promise<{
  scenario: Scenario;
  persona: Persona;
  responsiveness: Responsiveness;
}> {
  const res = await fetch('/api/persona', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenarioId }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'persona 실패');
  return res.json();
}

// 브라우저마다 녹음 포맷이 다르다(Chrome=webm/opus, iPad Safari=mp4). STT
// 제공자가 포맷을 오인하지 않게 blob.type 에 맞는 파일명을 붙인다.
function blobFilename(blob: Blob): string {
  const t = blob.type || '';
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'turn.mp4';
  if (t.includes('mpeg') || t.includes('mp3')) return 'turn.mp3';
  if (t.includes('ogg')) return 'turn.ogg';
  if (t.includes('wav')) return 'turn.wav';
  return 'turn.webm';
}

export async function transcribeBlob(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, blobFilename(blob));
  const res = await fetch('/api/stt', { method: 'POST', body: fd });
  if (!res.ok) throw new Error((await res.json()).error ?? 'STT 실패');
  return (await res.json()).text as string;
}

export type TurnResponse = {
  text: string;
  sycophancyRetries: number;
  regexFlaggedFinal: boolean;
  audioBase64: string | null;
  audioMime: string | null;
};

export async function fetchTurn(input: {
  scenario: Scenario;
  persona: Persona;
  responsiveness: Responsiveness;
  turns: Turn[];
  closing?: boolean;
}): Promise<TurnResponse> {
  const res = await fetch('/api/turn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'turn 실패');
  return res.json();
}

export async function fetchMetrics(
  turns: Turn[],
  responsiveness: Responsiveness,
): Promise<{ metrics: Metrics; promptVersion: string }> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ turns, responsiveness }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? '분석 실패');
  return res.json();
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
