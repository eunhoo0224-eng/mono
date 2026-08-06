// 데이터 모델 — 명세 7절 그대로.

export type Responsiveness =
  | 'engaged'
  | 'tired'
  | 'terse'
  | 'deflecting'
  | 'self_absorbed'
  | 'neutral';

export type ScenarioGroup = 'A' | 'B' | 'C';

export type Scenario = {
  id: string;
  group: ScenarioGroup;
  title: string;
  /** 상황 묘사 — 페르소나 프롬프트와 화면1에 쓰인다. */
  setting: string;
};

export type Persona = {
  age: number;
  gender: string;
  occupation: string;
  personality: string; // 외향/내향, 말수
  todayState: string; // 컨디션·기분·시간 여유
  speechStyle: string; // 존댓말/반말, 문장 길이, 습관어
  background: string; // 이 자리에 온 이유, 최근 관심사
  opennessReserve: string[]; // 사용자가 층을 올렸을 때 열 수 있는 재료
};

export type TurnEndReason = 'silence' | 'button' | 'maxLength';

export type Turn = {
  index: number;
  speaker: 'user' | 'persona';
  text: string;
  startedAt: number;
  endedAt: number;
  endedBy?: TurnEndReason; // user 턴만
  audioRange?: [number, number]; // 녹음 파일 내 위치(초)
  sycophancyRetries?: number; // persona 턴만 — 9절
};

export type Layer = 'fact' | 'opinion' | 'feeling' | 'value';

export type QuoteItem = { turnIndex: number; text: string; note?: string };

export type Metrics = {
  // ① 후속 질문
  followUpQuestions: { count: number; total: number; items: QuoteItem[] };
  nonFollowUpQuestions: QuoteItem[];
  // ② 층별 발화 분포
  layerDistribution: {
    user: Record<Layer, number>;
    persona: Record<Layer, number>;
  };
  // ③ 내가 먼저 연 횟수
  openedFirst: { count: number; attempts: number; items: QuoteItem[] };
  // ④ 발화 비율 (글자 수 기준)
  speechRatio: { user: number; persona: number };
  // ⑤ 최고 도달 층과 도달 턴
  deepestLayer: { layer: Layer; atTurn: number };
  // ⑥ 반응성 유형 공개
  responsiveness: Responsiveness;
  // 앱 자체 검증용 — 9절. 페르소나가 사용자 의견에 동의한 비율
  agreementRate: number;
};

export type Session = {
  id: string;
  startedAt: string;
  scenario: Scenario;
  persona: Persona; // 종료 전까지 UI에 노출 금지 (D2)
  responsiveness: Responsiveness;
  plannedTurns: number;
  silenceThresholdMs: number; // 기본 5000
  turns: Turn[];
  recordingBlobUrl?: string;
  metrics?: Metrics;
};

export type SetupConfig = {
  scenarioId: string | 'random';
  plannedTurns: number; // 기본 12, 6~20
  silenceThresholdMs: number; // 기본 5000, 3000~10000
  mode: 'voice' | 'text';
};
