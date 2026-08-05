'use client';
import { useState } from 'react';
import { SetupScreen } from '@/components/SetupScreen';
import { ConversationScreen } from '@/components/ConversationScreen';
import { ResultScreen } from '@/components/ResultScreen';
import { fetchPersona, fetchMetrics } from '@/client/api';
import type { Metrics, Persona, Responsiveness, Scenario, SetupConfig, Turn } from '@/lib/types';

type Phase = 'setup' | 'loading' | 'conversation' | 'analyzing' | 'result' | 'analyze_error';

export default function Home() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [responsiveness, setResponsiveness] = useState<Responsiveness>('neutral');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [promptVersion, setPromptVersion] = useState('v1');
  const [startedAt, setStartedAt] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState('');

  async function handleStart(c: SetupConfig) {
    setConfig(c);
    setPhase('loading');
    setErrorMsg('');
    try {
      const data = await fetchPersona(c.scenarioId);
      setScenario(data.scenario);
      setPersona(data.persona);
      setResponsiveness(data.responsiveness);
      setStartedAt(new Date());
      setPhase('conversation');
    } catch (e: any) {
      setErrorMsg(e?.message ?? '페르소나 생성 실패');
      setPhase('setup');
    }
  }

  async function handleFinish(finalTurns: Turn[], rec: Blob | null) {
    setTurns(finalTurns);
    setRecording(rec);
    setPhase('analyzing');
    try {
      const { metrics: m, promptVersion: v } = await fetchMetrics(finalTurns, responsiveness);
      setMetrics(m);
      setPromptVersion(v);
      setPhase('result');
    } catch (e: any) {
      setErrorMsg(e?.message ?? '지표 분석 실패');
      setPhase('analyze_error');
    }
  }

  function restart() {
    setPhase('setup');
    setTurns([]);
    setRecording(null);
    setMetrics(null);
    setErrorMsg('');
  }

  if (phase === 'setup') {
    return (
      <>
        {errorMsg && (
          <div className="app" style={{ paddingBottom: 0 }}>
            <p className="error">{errorMsg}</p>
          </div>
        )}
        <SetupScreen onStart={handleStart} />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="app">
        <p className="spinner">상대를 준비하는 중…</p>
      </div>
    );
  }

  if (phase === 'conversation' && config && scenario && persona) {
    return (
      <ConversationScreen
        config={config}
        scenario={scenario}
        persona={persona}
        responsiveness={responsiveness}
        onFinish={handleFinish}
      />
    );
  }

  if (phase === 'analyzing') {
    return (
      <div className="app">
        <p className="spinner">대화록을 분석하는 중…</p>
      </div>
    );
  }

  if (phase === 'result' && scenario && persona && metrics) {
    return (
      <ResultScreen
        scenario={scenario}
        persona={persona}
        turns={turns}
        metrics={metrics}
        recording={recording}
        startedAt={startedAt}
        promptVersion={promptVersion}
        onRestart={restart}
      />
    );
  }

  if (phase === 'analyze_error') {
    return (
      <div className="app">
        <h1>결과</h1>
        <p className="error">지표 분석에 실패했습니다: {errorMsg}</p>
        <p className="muted small">대화록과 녹음은 그대로 받을 수 있습니다.</p>
        <div className="grid2" style={{ marginTop: 16 }}>
          <button
            className="btn-primary"
            disabled={!recording}
            onClick={() => {
              if (!recording) return;
              const url = URL.createObjectURL(recording);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'conversation-practice.webm';
              a.click();
            }}
          >
            녹음 다운로드
          </button>
          <button
            onClick={() => {
              const text = turns
                .map((t) => `[${t.index}] ${t.speaker === 'user' ? '나' : '상대'}: ${t.text}`)
                .join('\n');
              const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = 'transcript.txt';
              a.click();
            }}
          >
            대화록 다운로드
          </button>
        </div>
        <button className="btn-big" style={{ marginTop: 24 }} onClick={restart}>
          새 대화
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <p className="spinner">…</p>
    </div>
  );
}
