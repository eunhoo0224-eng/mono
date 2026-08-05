// STT 프로바이더 — 명세 R-A. 서버에서 오디오 Blob → 텍스트.
// openai(기본) / local(의뢰인 mlx-whisper HTTP) / none(클라이언트 Web Speech 폴백).

export type SttProvider = 'openai' | 'local' | 'none';

export function sttProvider(): SttProvider {
  return (process.env.STT_PROVIDER as SttProvider) || 'openai';
}

// audio: 업로드된 파일(Blob/File). 반환: 전사 텍스트.
export async function transcribe(audio: Blob, filename = 'turn.webm'): Promise<string> {
  const provider = sttProvider();
  if (provider === 'none') {
    throw new Error('STT_PROVIDER=none — 서버 STT 비활성. 클라이언트에서 전사하세요.');
  }

  if (provider === 'local') {
    const url = process.env.LOCAL_STT_URL || 'http://127.0.0.1:8123/transcribe';
    const fd = new FormData();
    fd.append('file', audio, filename);
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`로컬 STT ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return (data.text ?? '').trim();
  }

  // openai
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY 가 없습니다 (STT).');
  const model = process.env.OPENAI_STT_MODEL || 'gpt-4o-transcribe';
  const fd = new FormData();
  fd.append('file', audio, filename);
  fd.append('model', model);
  fd.append('language', 'ko');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`OpenAI STT ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return (data.text ?? '').trim();
}
