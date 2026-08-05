'use client';
// 2절의 세 한계를 UI 에 상시 노출 (D5). 접힌 형태.

export function LimitationsNote({ open = false }: { open?: boolean }) {
  return (
    <details className="limits" open={open}>
      <summary>이 연습이 못 하는 것 (원리적 한계 · 눌러서 보기)</summary>
      <ul>
        <li>
          <b>상호성의 실질</b> — AI에게는 열 자기가 없어 취약해질 위험이 없다. 여기서는
          형식(순서·타이밍)만 연습된다.
        </li>
        <li>
          <b>거절 내성</b> — 손실 가능성이 없다. 거절당하는 감각은 연습되지 않는다.
        </li>
        <li>
          <b>캘리브레이션</b> — 실제 사람이 얼마나 관심 있어 하는지는 실전에서만 교정된다.
          그래서 이 앱의 상대는 늘 관심 있어 주지 <i>않는다</i>.
        </li>
      </ul>
    </details>
  );
}
