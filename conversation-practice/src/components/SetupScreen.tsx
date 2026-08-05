'use client';
import { useState } from 'react';
import { SCENARIOS } from '@/lib/scenarios';
import type { SetupConfig } from '@/lib/types';
import { LimitationsNote } from './LimitationsNote';

const GROUP_LABEL: Record<string, string> = {
  A: 'A군 — 실제로 갈 자리',
  B: 'B군 — 초면 스몰토크',
  C: 'C군 — 이성과의 대화',
};

export function SetupScreen({ onStart }: { onStart: (c: SetupConfig) => void }) {
  const [scenarioId, setScenarioId] = useState<string>('random');
  const [plannedTurns, setPlannedTurns] = useState(12);
  const [silenceSec, setSilenceSec] = useState(5);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');

  return (
    <div className="app">
      <h1>대화 연습</h1>
      <p className="muted small">
        AI 상대와 음성으로 대화를 주고받고, 끝나면 녹음 파일과 행동 지표를 받는다.
        연습 중에는 코칭·점수·힌트가 없다.
      </p>

      <div className="panel">
        <label htmlFor="scenario">시나리오</label>
        <select id="scenario" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          <option value="random">아무거나 (무작위)</option>
          {(['A', 'B', 'C'] as const).map((g) => (
            <optgroup key={g} label={GROUP_LABEL[g]}>
              {SCENARIOS.filter((s) => s.group === g).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <label>턴 수 — 내가 말하는 횟수: {plannedTurns}</label>
        <input
          type="range"
          min={6}
          max={20}
          value={plannedTurns}
          onChange={(e) => setPlannedTurns(Number(e.target.value))}
        />

        <label>침묵 대기 시간: {silenceSec}초 (말이 없으면 턴이 넘어감)</label>
        <input
          type="range"
          min={3}
          max={10}
          value={silenceSec}
          onChange={(e) => setSilenceSec(Number(e.target.value))}
        />
        <p className="muted small" style={{ marginTop: 4 }}>
          생각하느라 멈추면 초기값 5초는 짧을 수 있다. 몇 번 해보고 조정하자.
        </p>

        <label>모드</label>
        <div className="radio-row">
          <button
            className={mode === 'voice' ? 'active' : ''}
            onClick={() => setMode('voice')}
            type="button"
          >
            음성
          </button>
          <button
            className={mode === 'text' ? 'active' : ''}
            onClick={() => setMode('text')}
            type="button"
          >
            텍스트 (마이크 못 쓸 때)
          </button>
        </div>
      </div>

      <button
        className="btn-primary btn-big"
        onClick={() =>
          onStart({ scenarioId, plannedTurns, silenceThresholdMs: silenceSec * 1000, mode })
        }
      >
        시작
      </button>

      <p className="muted small" style={{ marginTop: 16 }}>
        상대가 어떤 사람인지, 오늘 어떤 컨디션인지는 <b>미리 알려주지 않는다.</b> 끝난 뒤에
        공개된다.
      </p>

      <LimitationsNote />
    </div>
  );
}
