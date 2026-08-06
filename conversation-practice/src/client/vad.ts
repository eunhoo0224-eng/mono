// 침묵 감지 (VAD) — 명세 F4 / 12-3. 공유 마이크 스트림에 AnalyserNode 를 붙여
// 에너지(RMS) 기반으로 발화/침묵을 판정한다. 라이브러리 통합 리스크 없이 확실히
// 동작하는 기본 구현. (Silero @ricky0123/vad-web 으로의 교체는 README 참조.)
//
// 핵심 규칙(12-3):
//  - 사용자가 "한 번이라도 말한 뒤" 부터 침묵 카운트다운 시작 (빈 턴 폭주 방지)
//  - 카운트다운 중 말이 재개되면 즉시 리셋
//  - 임계값(thresholdMs) 설정 가능, 카운트다운 잔여시간을 콜백으로 노출

export type SilenceDetectorOptions = {
  thresholdMs: number;
  /** 카운트다운 갱신. remainingMs=null 이면 카운트다운 해제(발화 중/리셋). */
  onCountdown: (remainingMs: number | null) => void;
  /** 침묵이 임계값을 넘어 턴 종료. */
  onTurnEnd: () => void;
};

export class SilenceDetector {
  private analyser: AnalyserNode;
  private data: Float32Array;
  private raf = 0;
  private active = false;
  private paused = false;
  private hasSpoken = false;
  private lastVoiceTs = 0;
  private threshold = 0.015; // 보정으로 갱신
  private calibrating = true;
  private calibrateUntil = 0;
  private noiseSamples: number[] = [];
  private countingDown = false;

  constructor(
    private ctx: AudioContext,
    micSource: AudioNode,
    private opts: SilenceDetectorOptions,
  ) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.data = new Float32Array(this.analyser.fftSize);
    micSource.connect(this.analyser);
  }

  private rms(): number {
    // TS 5.7+ 의 typed-array 제네릭(Float32Array<ArrayBuffer>) 호환용 캐스트.
    this.analyser.getFloatTimeDomainData(this.data as unknown as Float32Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) sum += this.data[i] * this.data[i];
    return Math.sqrt(sum / this.data.length);
  }

  /** 새 user 턴 시작. 상태 초기화 + 노이즈 플로어 재보정. */
  start() {
    this.active = true;
    this.paused = false;
    this.hasSpoken = false;
    this.countingDown = false;
    this.calibrating = true;
    this.noiseSamples = [];
    this.calibrateUntil = performance.now() + 400; // 400ms 주변 소음 측정
    this.lastVoiceTs = performance.now();
    this.opts.onCountdown(null);
    cancelAnimationFrame(this.raf);
    this.loop();
  }

  pause() {
    this.paused = true;
    this.countingDown = false;
    this.opts.onCountdown(null);
  }

  resume() {
    if (!this.active) return;
    this.paused = false;
    this.lastVoiceTs = performance.now(); // 재개 시점부터 다시 카운트
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.opts.onCountdown(null);
  }

  private loop = () => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.paused) return;

    const now = performance.now();
    const level = this.rms();

    // 노이즈 플로어 보정
    if (this.calibrating) {
      this.noiseSamples.push(level);
      if (now >= this.calibrateUntil && this.noiseSamples.length > 0) {
        const avg = this.noiseSamples.reduce((a, b) => a + b, 0) / this.noiseSamples.length;
        this.threshold = Math.max(avg * 2.5, 0.012);
        this.calibrating = false;
      }
      return; // 보정 중에는 판정하지 않음
    }

    if (level > this.threshold) {
      // 발화 중
      this.lastVoiceTs = now;
      this.hasSpoken = true;
      if (this.countingDown) {
        this.countingDown = false;
        this.opts.onCountdown(null); // 리셋
      }
      return;
    }

    // 침묵
    if (!this.hasSpoken) return; // 아직 한 번도 안 말함 → 카운트 안 함
    const silentFor = now - this.lastVoiceTs;
    const remaining = this.opts.thresholdMs - silentFor;
    if (remaining <= 0) {
      this.stop();
      this.opts.onTurnEnd();
    } else {
      this.countingDown = true;
      this.opts.onCountdown(remaining);
    }
  };
}
