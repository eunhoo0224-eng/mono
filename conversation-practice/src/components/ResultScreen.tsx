'use client';
import type { Layer, Metrics, Persona, Responsiveness, Scenario, Turn } from '@/lib/types';
import { recordingFilename } from '@/client/audio';
import { RESPONSIVENESS_BEHAVIOR } from '@/lib/persona';

const LAYER_KO: Record<Layer, string> = {
  fact: '사실',
  opinion: '의견',
  feeling: '감정',
  value: '가치',
};

const RESP_KO: Record<Responsiveness, string> = {
  engaged: '관심 있는 날 (engaged)',
  tired: '피곤한 날 (tired)',
  terse: '짧게 답하는 사람 (terse)',
  deflecting: '화제를 돌리는 사람 (deflecting)',
  self_absorbed: '자기 이야기만 (self_absorbed)',
  neutral: '보통 (neutral)',
};

type Props = {
  scenario: Scenario;
  persona: Persona;
  turns: Turn[];
  metrics: Metrics;
  recording: Blob | null;
  startedAt: Date;
  promptVersion: string;
  onRestart: () => void;
};

export function ResultScreen({
  scenario,
  persona,
  turns,
  metrics,
  recording,
  startedAt,
  promptVersion,
  onRestart,
}: Props) {
  const ext = recording?.type.includes('mp4') ? 'm4a' : 'webm';
  const recName = recordingFilename(scenario.title, startedAt, ext);

  function downloadRecording() {
    if (!recording) return;
    const url = URL.createObjectURL(recording);
    triggerDownload(url, recName);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadTranscript() {
    const lines = turns.map(
      (t) => `[${t.index}] ${t.speaker === 'user' ? '나' : '상대'}: ${t.text}`,
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, recName.replace(/\.(webm|m4a)$/, '.txt'));
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const totalChars = metrics.speechRatio.user + metrics.speechRatio.persona || 1;
  const userPct = Math.round((metrics.speechRatio.user / totalChars) * 100);

  return (
    <div className="app">
      <h1>결과</h1>
      <p className="muted small">
        아래는 집계된 숫자와, 그 숫자가 어떤 발화에서 나왔는지다. 평가나 조언은 없다 —
        판단은 당신 몫이다.
      </p>

      {/* 지표 표 */}
      <h2>지표</h2>
      <div className="panel">
        <table>
          <tbody>
            <tr>
              <th>① 후속 질문</th>
              <td>
                {metrics.followUpQuestions.count}개 / 전체 질문 {metrics.followUpQuestions.total}개
              </td>
            </tr>
            <tr>
              <th>③ 내가 먼저 연 것</th>
              <td>
                {metrics.openedFirst.count}회 / 층을 올리려 시도한 {metrics.openedFirst.attempts}회
              </td>
            </tr>
            <tr>
              <th>④ 발화 비율 (글자 수)</th>
              <td>
                나 {userPct}% : 상대 {100 - userPct}%
              </td>
            </tr>
            <tr>
              <th>⑤ 최고 도달 층</th>
              <td>
                {LAYER_KO[metrics.deepestLayer.layer]} (턴 {metrics.deepestLayer.atTurn})
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ② 층별 분포 */}
      <h2>② 층별 발화 분포</h2>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>층</th>
              <th>나</th>
              <th>상대</th>
            </tr>
          </thead>
          <tbody>
            {(['fact', 'opinion', 'feeling', 'value'] as Layer[]).map((l) => (
              <tr key={l}>
                <th>{LAYER_KO[l]}</th>
                <td>{metrics.layerDistribution.user[l]}</td>
                <td>{metrics.layerDistribution.persona[l]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          나란히 본다. 상대는 사실만 말하는데 내가 가치를 묻고 있었다면, 그건 그대로 하나의
          사실이다.
        </p>
      </div>

      {/* ① 후속 질문 인용 */}
      <h2>후속 질문으로 센 것 ({metrics.followUpQuestions.count})</h2>
      {metrics.followUpQuestions.items.length === 0 && <p className="muted small">없음</p>}
      {metrics.followUpQuestions.items.map((q, i) => (
        <div className="quote" key={`f${i}`}>
          <div>[턴 {q.turnIndex}] “{q.text}”</div>
          {q.note && <div className="note">{q.note}</div>}
        </div>
      ))}

      <h2>세지 않은 질문 (새 화제 등)</h2>
      {metrics.nonFollowUpQuestions.length === 0 && <p className="muted small">없음</p>}
      {metrics.nonFollowUpQuestions.map((q, i) => (
        <div className="quote excluded" key={`n${i}`}>
          <div>[턴 {q.turnIndex}] “{q.text}”</div>
          {q.note && <div className="note">{q.note}</div>}
        </div>
      ))}

      {/* ③ 먼저 연 것 인용 */}
      {metrics.openedFirst.items.length > 0 && (
        <>
          <h2>내가 먼저 연 발화</h2>
          {metrics.openedFirst.items.map((q, i) => (
            <div className="quote" key={`o${i}`}>
              <div>[턴 {q.turnIndex}] “{q.text}”</div>
              {q.note && <div className="note">{q.note}</div>}
            </div>
          ))}
        </>
      )}

      {/* ⑥ 반응성 공개 (D2) */}
      <h2>⑥ 상대의 반응성 유형 (지금 공개)</h2>
      <div className="panel">
        <p>
          <span className="badge">{RESP_KO[metrics.responsiveness]}</span>
        </p>
        <p className="muted small">{RESPONSIVENESS_BEHAVIOR[metrics.responsiveness]}</p>
        <p className="muted small">
          이 유형은 세션 시작 시 확률적으로 뽑혔고, 대화 중에는 알리지 않았다. 위 숫자들은 이
          조건에서 나온 것이다.
        </p>
      </div>

      {/* 페르소나 공개 */}
      <details className="limits">
        <summary>상대는 어떤 사람이었나 (눌러서 보기)</summary>
        <ul>
          <li>
            {persona.age}세 {persona.gender} · {persona.occupation}
          </li>
          <li>성격: {persona.personality}</li>
          <li>오늘: {persona.todayState}</li>
          <li>말투: {persona.speechStyle}</li>
          <li>배경: {persona.background}</li>
        </ul>
      </details>

      {/* 앱 자체 검증 지표 */}
      <div className="panel" style={{ marginTop: 20 }}>
        <div className="row-between">
          <span className="muted small">앱 자체 검증 · agreementRate (동의 비율)</span>
          <span className={`badge ${metrics.agreementRate >= 0.5 ? 'warn-badge' : ''}`}>
            {metrics.agreementRate.toFixed(2)}
          </span>
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>
          상대가 당신 의견에 근거 없이 동의한 비율. 0.5 이상이면 아첨 방지가 덜 작동한 것(앱의
          문제이지 당신의 문제가 아니다). 분석 프롬프트 버전: {promptVersion}
        </p>
      </div>

      {/* 다운로드 */}
      <h2>다운로드</h2>
      <div className="grid2">
        <button className="btn-primary" onClick={downloadRecording} disabled={!recording}>
          🎙 녹음 파일 (.{ext})
        </button>
        <button onClick={downloadTranscript}>📝 대화록 (.txt)</button>
      </div>
      {!recording && (
        <p className="muted small">텍스트 모드였거나 녹음이 없어 오디오 파일은 없습니다.</p>
      )}
      <p className="muted small">
        권장: 녹음 파일을 <code>00_원장/녹음/</code> 폴더에 넣으면 기존 전사 파이프라인이
        이어받습니다. (파일명 규칙은 이미 맞춰져 있습니다)
      </p>

      <button className="btn-big" style={{ marginTop: 24 }} onClick={onRestart}>
        새 대화
      </button>
    </div>
  );
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
