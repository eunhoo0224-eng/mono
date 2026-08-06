// 오디오 믹서 + 녹음 — 명세 R-D / F1. 마이크 + AI TTS 를 한 파일에.
// 브라우저 전용.

export type RecorderHandle = {
  ctx: AudioContext;
  micSource: MediaStreamAudioSourceNode;
  /** AI TTS(mp3 등) 를 재생하면서 동시에 녹음에 합류. 재생 끝나면 resolve.
   *  반환: [시작초, 끝초] — 녹음 파일 내 위치(Turn.audioRange). */
  playTts: (audio: ArrayBuffer) => Promise<[number, number]>;
  /** 현재까지 경과 시간(초). audioRange 계산용. */
  elapsed: () => number;
  /** TTS 가 지금 재생 중인가 (VAD 게이팅용). */
  isPlaying: () => boolean;
  /** 녹음 종료 → Blob. */
  stop: () => Promise<Blob>;
};

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4', // Safari
    'audio/ogg;codecs=opus',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export async function createRecorder(micStream: MediaStream): Promise<RecorderHandle> {
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const dest = ctx.createMediaStreamDestination();

  // 마이크 → 녹음(dest). 스피커로는 보내지 않는다(자기 목소리 에코 방지).
  const micSource = ctx.createMediaStreamSource(micStream);
  const micGain = ctx.createGain();
  micGain.gain.value = 1.0;
  micSource.connect(micGain).connect(dest);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  // 12-5: 5초마다 flush 해 긴 세션 메모리 급증 방지.
  recorder.start(5000);

  const startTime = ctx.currentTime;
  let playing = false;

  const handle: RecorderHandle = {
    ctx,
    micSource,
    elapsed: () => ctx.currentTime - startTime,
    isPlaying: () => playing,

    playTts: async (audio: ArrayBuffer) => {
      // iOS Safari 는 오디오를 suspended 로 두는 경우가 있다(백그라운드 복귀 등).
      // 재생 직전 깨워 AI 음성이 무음이 되지 않게 한다.
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* 제스처가 없으면 실패할 수 있다 — 아래 gesture 언락이 보완 */
        }
      }
      const buf = await ctx.decodeAudioData(audio.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const ttsGain = ctx.createGain();
      ttsGain.gain.value = 0.9; // AI 가 너무 크지 않게 (R-D 밸런스)
      src.connect(ttsGain);
      ttsGain.connect(dest); // 녹음에 합류
      ttsGain.connect(ctx.destination); // 사용자 스피커로

      const start = ctx.currentTime - startTime;
      playing = true;
      return new Promise<[number, number]>((resolve) => {
        src.onended = () => {
          playing = false;
          resolve([start, ctx.currentTime - startTime]);
        };
        src.start();
      });
    },

    stop: async () => {
      return new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
        };
        recorder.stop();
      });
    },
  };

  return handle;
}

export function recordingFilename(scenarioTitle: string, startedAt: Date, ext = 'webm'): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = `${startedAt.getFullYear()}-${pad(startedAt.getMonth() + 1)}-${pad(startedAt.getDate())}`;
  const t = `${pad(startedAt.getHours())}${pad(startedAt.getMinutes())}`;
  // 명세 R-D 창고 연동 권장 규칙: 대화연습_YYYY-MM-DD_HHMM_시나리오명.ext
  const safe = scenarioTitle.replace(/[\\/:*?"<>|]/g, '');
  return `대화연습_${d}_${t}_${safe}.${ext}`;
}
