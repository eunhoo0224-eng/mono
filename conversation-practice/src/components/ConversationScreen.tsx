'use client';
import { useEffect, useRef, useState } from 'react';
import type { Persona, Responsiveness, Scenario, SetupConfig, Turn } from '@/lib/types';
import { createRecorder, type RecorderHandle } from '@/client/audio';
import { SilenceDetector } from '@/client/vad';
import { fetchTurn, transcribeBlob, base64ToArrayBuffer } from '@/client/api';
import { speakFallback } from '@/client/speech';
import { LimitationsNote } from './LimitationsNote';

type Phase = 'init' | 'persona_speaking' | 'listening' | 'processing' | 'paused' | 'error';

type Props = {
  config: SetupConfig;
  scenario: Scenario;
  persona: Persona;
  responsiveness: Responsiveness;
  onFinish: (turns: Turn[], recording: Blob | null) => void;
};

export function ConversationScreen({ config, scenario, persona, responsiveness, onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('init');
  const [personaText, setPersonaText] = useState('');
  const [userLive, setUserLive] = useState('');
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  const [textMode, setTextMode] = useState(config.mode === 'text');
  const [notice, setNotice] = useState('');

  const turnsRef = useRef<Turn[]>([]);
  const indexRef = useRef(0);
  const userCountRef = useRef(0);
  const emptyRetriesRef = useRef(0);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<SilenceDetector | null>(null);
  const uttRecorderRef = useRef<MediaRecorder | null>(null);
  const uttChunksRef = useRef<BlobPart[]>([]);
  const bootedRef = useRef(false);
  const phaseRef = useRef<Phase>('init');
  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    if (bootedRef.current) return; // StrictMode 이중 마운트 가드
    bootedRef.current = true;
    void bootstrap();
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bootstrap() {
    if (!textMode) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        micStreamRef.current = stream;
        recorderRef.current = await createRecorder(stream);
        detectorRef.current = new SilenceDetector(
          recorderRef.current.ctx,
          recorderRef.current.micSource,
          {
            thresholdMs: config.silenceThresholdMs,
            onCountdown: (ms) => setCountdownMs(ms),
            onTurnEnd: () => void endUserTurn('silence'),
          },
        );
      } catch {
        setTextMode(true);
        setNotice('마이크를 쓸 수 없어 텍스트 모드로 진행합니다. (녹음 파일은 만들어지지 않습니다)');
      }
    }
    void runPersonaTurn(false);
  }

  function teardown() {
    detectorRef.current?.stop();
    try {
      uttRecorderRef.current?.stop();
    } catch {}
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function pushTurn(t: Turn) {
    turnsRef.current = [...turnsRef.current, t];
  }

  async function runPersonaTurn(closing: boolean) {
    setPhaseSafe('persona_speaking');
    setCountdownMs(null);
    setUserLive('');
    const startedAt = performance.now();
    let res;
    try {
      res = await fetchTurn({
        scenario,
        persona,
        responsiveness,
        turns: turnsRef.current,
        closing,
      });
    } catch (e: any) {
      setErrorMsg(e?.message ?? '응답 생성 실패');
      setPhaseSafe('error');
      return;
    }
    setPersonaText(res.text);
    let range: [number, number] | undefined;
    try {
      if (res.audioBase64 && recorderRef.current) {
        range = await recorderRef.current.playTts(base64ToArrayBuffer(res.audioBase64));
      } else {
        // 서버 TTS 없음 → 브라우저 음성(녹음 안 됨).
        await speakFallback(res.text);
      }
    } catch {
      /* 재생 실패해도 대화는 이어간다 */
    }
    pushTurn({
      index: indexRef.current++,
      speaker: 'persona',
      text: res.text,
      startedAt,
      endedAt: performance.now(),
      audioRange: range,
      sycophancyRetries: res.sycophancyRetries,
    });

    if (closing) {
      void finish();
      return;
    }
    startUserTurn();
  }

  function startUserTurn() {
    setPhaseSafe('listening');
    setUserLive('');
    setCountdownMs(null);
    if (textMode) return; // 입력 대기
    startUtteranceRecorder();
    detectorRef.current?.start();
  }

  function startUtteranceRecorder() {
    if (!micStreamRef.current) return;
    const mr = new MediaRecorder(micStreamRef.current);
    uttChunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) uttChunksRef.current.push(e.data);
    };
    mr.start();
    uttRecorderRef.current = mr;
  }

  function stopUtteranceRecorder(): Promise<Blob> {
    return new Promise((resolve) => {
      const mr = uttRecorderRef.current;
      if (!mr || mr.state === 'inactive') {
        return resolve(new Blob(uttChunksRef.current, { type: 'audio/webm' }));
      }
      mr.onstop = () => resolve(new Blob(uttChunksRef.current, { type: mr.mimeType || 'audio/webm' }));
      mr.stop();
    });
  }

  // endedBy: 'silence'(VAD) | 'button'(다음)
  async function endUserTurn(endedBy: 'silence' | 'button') {
    if (phaseRef.current !== 'listening') return; // 중복/오발 가드
    setPhaseSafe('processing');
    setCountdownMs(null);
    detectorRef.current?.stop();
    const startedAt = performance.now();

    const blob = await stopUtteranceRecorder();
    let text = '';
    try {
      text = (await transcribeBlob(blob)).trim();
    } catch (e: any) {
      // STT 실패 → 텍스트 비움. 아래에서 재시도 처리.
      text = '';
    }

    if (!text) {
      // 인식이 비면 최대 3회까지 다시 듣는다. 그 뒤엔 넘어간다.
      if (emptyRetriesRef.current < 3 && endedBy === 'silence') {
        emptyRetriesRef.current += 1;
        setNotice('잘 들리지 않았어요. 다시 말씀해 주세요.');
        startUserTurn();
        return;
      }
      text = '(인식되지 않음)';
    }
    emptyRetriesRef.current = 0;
    setNotice('');

    pushTurn({
      index: indexRef.current++,
      speaker: 'user',
      text,
      startedAt,
      endedAt: performance.now(),
      endedBy,
    });
    const count = userCountRef.current + 1;
    userCountRef.current = count;
    setUserTurnCount(count);
    void runPersonaTurn(count >= config.plannedTurns);
  }

  function submitText() {
    const t = textInput.trim();
    if (!t || phaseRef.current !== 'listening') return;
    pushTurn({
      index: indexRef.current++,
      speaker: 'user',
      text: t,
      startedAt: performance.now(),
      endedAt: performance.now(),
      endedBy: 'button',
    });
    setTextInput('');
    const count = userCountRef.current + 1;
    userCountRef.current = count;
    setUserTurnCount(count);
    void runPersonaTurn(count >= config.plannedTurns);
  }

  function togglePause() {
    if (phaseRef.current === 'listening') {
      detectorRef.current?.pause();
      try {
        uttRecorderRef.current?.pause();
      } catch {}
      setCountdownMs(null);
      setPhaseSafe('paused');
    } else if (phaseRef.current === 'paused') {
      setPhaseSafe('listening');
      try {
        uttRecorderRef.current?.resume();
      } catch {}
      detectorRef.current?.resume();
    }
  }

  async function finish() {
    detectorRef.current?.stop();
    let blob: Blob | null = null;
    try {
      if (recorderRef.current) blob = await recorderRef.current.stop();
    } catch {}
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    onFinish(turnsRef.current, blob);
  }

  const statusText: Record<Phase, string> = {
    init: '준비 중…',
    persona_speaking: '상대가 말하는 중…',
    listening: textMode ? '당신 차례 — 입력하세요' : '당신 차례 — 말하세요',
    processing: '듣는 중…',
    paused: '일시정지',
    error: '오류',
  };

  const countdownPct =
    countdownMs != null ? Math.max(0, Math.min(100, (countdownMs / config.silenceThresholdMs) * 100)) : 0;

  return (
    <div className="app">
      <div className="row-between">
        <span className="turn-counter">{scenario.title}</span>
        <span className="turn-counter">
          현재 {Math.min(userTurnCount + (phase === 'listening' ? 1 : 0), config.plannedTurns)} / 전체{' '}
          {config.plannedTurns}
        </span>
      </div>

      <div className="stage">
        <div className="bubble-persona">{personaText || '…'}</div>
        <div className="bubble-user">{userLive}</div>
        <div className="status-line">{statusText[phase]}</div>

        {countdownMs != null && (
          <div className="countdown-wrap">
            <div className="countdown-bar">
              <div className="countdown-fill" style={{ width: `${countdownPct}%` }} />
            </div>
            <div className="countdown-num">{(countdownMs / 1000).toFixed(1)}초 뒤 넘어감</div>
          </div>
        )}
      </div>

      {notice && (
        <p className="muted small" style={{ textAlign: 'center' }}>
          {notice}
        </p>
      )}

      {phase === 'error' && (
        <div className="panel">
          <p className="error">{errorMsg}</p>
          <button onClick={() => finish()}>여기서 종료하고 결과 보기</button>
        </div>
      )}

      {textMode ? (
        <div className="panel">
          <textarea
            rows={2}
            value={textInput}
            placeholder={phase === 'listening' ? '메시지를 입력하고 Enter' : '상대가 말하는 중…'}
            disabled={phase !== 'listening'}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitText();
              }
            }}
          />
          <div className="controls">
            <button
              className="btn-primary btn-big"
              disabled={phase !== 'listening'}
              onClick={submitText}
            >
              보내기 (다음)
            </button>
            <button className="btn-secondary" onClick={() => finish()}>
              중단
            </button>
          </div>
        </div>
      ) : (
        <div className="controls">
          <button
            className="btn-primary btn-big"
            disabled={phase !== 'listening'}
            onClick={() => void endUserTurn('button')}
          >
            다음 ▸
          </button>
          <button
            className="btn-secondary"
            disabled={phase !== 'listening' && phase !== 'paused'}
            onClick={togglePause}
          >
            {phase === 'paused' ? '재개' : '일시정지'}
          </button>
          <button className="btn-secondary btn-danger" onClick={() => finish()}>
            중단
          </button>
        </div>
      )}

      <LimitationsNote />
    </div>
  );
}
