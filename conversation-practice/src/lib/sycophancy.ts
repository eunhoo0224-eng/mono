// 아첨 검출 — 명세 9절 ⑤ 후처리 게이트의 1차(정규식) 검사.
// 2차(경량 LLM 판정)는 서버 라우트에서 JUDGE_PROVIDER 로 호출한다.

// 금지 표현 정규식 (9절 ①). 최종 응답에 이게 남으면 검수 7번 실패.
// 맥락 없이 감탄/동의/칭찬만 하거나, 어시스턴트 티가 나는 표지들.
const FORBIDDEN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /좋은\s*질문(이네요|이에요|입니다|이세요)/, label: '좋은 질문' },
  { re: /흥미(롭네요|로워요|롭습니다)/, label: '흥미롭네요' },
  { re: /대단(하시네요|해요|하세요|합니다)/, label: '대단하시네요' },
  { re: /멋(지네요|져요|지세요|집니다)/, label: '멋지네요' },
  { re: /훌륭(하시네요|해요|합니다)/, label: '훌륭하네요' },
  { re: /정말\s*[좋멋대]/, label: '정말 좋/멋/대…' },
  // "맞아요"가 문장 시작 또는 단독으로 오는 무조건 동의
  { re: /(^|[\s.!?…,])맞아요/, label: '맞아요(무조건 동의)' },
  { re: /저도\s*(그렇게|똑같이)\s*생각(해요|합니다)/, label: '저도 그렇게 생각해요' },
  { re: /제가\s*도와드릴/, label: '어시스턴트 말투(도와드릴)' },
  { re: /무엇을\s*도와/, label: '어시스턴트 말투(무엇을 도와)' },
  // 목록/불릿/번호매기기 — 사람은 이렇게 말하지 않는다
  { re: /(^|\n)\s*[-*•]\s+/, label: '불릿 목록' },
  { re: /(^|\n)\s*\d+[.)]\s+/, label: '번호 목록' },
  // 굵은 글씨(markdown)
  { re: /\*\*[^*]+\*\*/, label: '굵은 글씨' },
];

export type RegexGateResult = { flagged: boolean; hits: string[] };

export function regexSycophancyGate(text: string): RegexGateResult {
  const hits: string[] = [];
  for (const { re, label } of FORBIDDEN_PATTERNS) {
    if (re.test(text)) hits.push(label);
  }
  return { flagged: hits.length > 0, hits };
}

// "정말요?" 처럼 감탄만 하는 반문 — 다른 내용 없이 이것뿐일 때만 아첨.
export function isBareExclamation(text: string): boolean {
  const t = text.trim();
  return /^(정말요|진짜요|와|우와|헐)[?!.…\s]*$/.test(t);
}

export function looksSycophantic(text: string): RegexGateResult {
  const base = regexSycophancyGate(text);
  if (isBareExclamation(text)) {
    return { flagged: true, hits: [...base.hits, '감탄만 하는 반문'] };
  }
  return base;
}
