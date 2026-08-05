// 시나리오 목록 — 명세 11절.
import type { Scenario } from './types';

export const SCENARIOS: Scenario[] = [
  // A군 — 실제로 갈 자리 (전이가 가장 유리)
  { id: 'a1', group: 'A', title: '독서모임 뒤풀이', setting: '독서모임이 끝나고 근처 식당으로 자리를 옮겼다. 방금까지 같은 책 이야기를 나눈 사이라 아주 낯설지는 않다.' },
  { id: 'a2', group: 'A', title: '러닝 후 커피', setting: '아침 러닝 모임이 끝나고 편의점 앞. 둘 다 숨을 고르며 커피를 들고 서 있다.' },
  { id: 'a3', group: 'A', title: '클라이밍 순서 기다리며', setting: '클라이밍장 벽 아래에서 차례를 기다리는 중. 방금 서로의 시도를 지켜봤다.' },
  { id: 'a4', group: 'A', title: '밋업 네트워킹', setting: '발표가 끝나고 서서 이야기하는 네트워킹 시간. 음료를 들고 있다.' },
  { id: 'a5', group: 'A', title: '봉사활동 뒤 식사', setting: '함께 봉사활동을 마치고 다 같이 밥을 먹으러 왔다. 옆자리에 앉게 됐다.' },
  { id: 'a6', group: 'A', title: '스터디 쉬는 시간', setting: '스터디 중간 쉬는 시간. 잠깐 바람 쐬러 나온 자리에서 마주쳤다.' },

  // B군 — 초면 스몰토크 (0에서 시작)
  { id: 'b7', group: 'B', title: '행사장에서 옆자리', setting: '행사장에서 우연히 옆자리에 앉았다. 아는 사람이 아무도 없는 상황이다.' },
  { id: 'b8', group: 'B', title: '줄 서서 기다리며', setting: '어딘가에 줄을 서서 기다리다 우연히 말이 트였다.' },
  { id: 'b9', group: 'B', title: '소개로 만난 자리', setting: '지인의 소개로 처음 만난 자리. 서로에 대해 아는 것이 거의 없다.' },
  { id: 'b10', group: 'B', title: '팀 배정 직후', setting: '워크숍이나 모임에서 방금 같은 팀으로 배정됐다. 이제 함께 뭔가를 해야 한다.' },

  // C군 — 이성과의 대화
  { id: 'c11', group: 'C', title: '소개팅', setting: '소개팅으로 카페에서 만났다. 시간은 넉넉하다.' },
  { id: 'c12', group: 'C', title: '모임에서 관심이 가는 사람과', setting: '여럿이 모인 자리에서, 관심이 가는 상대와 잠깐 따로 이야기하게 됐다.' },
  { id: 'c13', group: 'C', title: '두 번째 만남', setting: '한 번 만난 적 있는 상대와 두 번째로 만났다. 첫 만남은 나쁘지 않았다.' },
  { id: 'c14', group: 'C', title: '알던 사이에서 층을 올리기', setting: '몇 번 봤지만 늘 표면적인 이야기에서 끝났던 상대와 다시 만났다.' },
];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
);

export function pickScenario(id: string | 'random'): Scenario {
  if (id !== 'random' && SCENARIO_BY_ID[id]) return SCENARIO_BY_ID[id];
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

// C군 주의 (명세 11절): 이 앱은 "궁합 점수" 같은 것을 내지 않는다. 목표는
// 상대를 판별하는 것이 아니라 대화를 이어 가는 것이다. — 결과 화면·분석
// 프롬프트 어디에도 궁합/매칭 판정을 넣지 않는다.
