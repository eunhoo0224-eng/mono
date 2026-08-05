# 대화 연습 웹앱

혼자서 대화를 연습하는 웹앱. AI 페르소나와 **음성으로 실시간 대화**를 주고받고,
끝나면 **녹음 파일**과 **행동 지표 6종**을 받는다. 일반 음성 챗봇과 다른 점은
지표를 세고, **AI가 아첨만 하지 않게** 막는다는 것이다.

설계 근거는 [`제작 명세.md`]와 리서치 결론은 [`리서치결과.md`](./리서치결과.md)에
있다. 이 앱은 명세 4절 리서치 → 5절 아키텍처 확정(**파이프라인 A안**) 순서로
만들어졌다.

## 무엇을 하지 않는가 (의도된 제약)

- 대화 중 **코칭·힌트·점수 없음** (D3)
- 결과 화면에 **총평·조언·격려 없음.** 숫자와 인용, 판정 근거만 (D4)
- **궁합 점수·상대 분석 없음** (11절 C군 주의)
- 상대의 성격·반응성은 **끝나기 전까지 비공개** (D2)

---

## 실행

```bash
cd conversation-practice
npm install

cp .env.example .env.local   # 키와 프로바이더 채우기 (아래 참조)
npm run dev                   # http://localhost:3000
```

> **HTTPS/마이크**: 마이크는 `localhost` 또는 HTTPS 에서만 동작한다(12-1).
> 로컬 개발은 `localhost` 라 그대로 된다. 배포 시엔 HTTPS 필수.

### 환경 변수 (`.env.local`)

키는 **서버 라우트에서만** 쓰인다. 클라이언트로 나가지 않는다(명세 5절).

| 변수 | 뜻 | 기본 |
|---|---|---|
| `CONVERSATION_PROVIDER` | 페르소나 연기 LLM | `claude` |
| `JUDGE_PROVIDER` | 아첨 2차 판정(경량) | `claude` |
| `ANALYSIS_PROVIDER` | 지표 분석 LLM (대화와 **분리** 권장) | `openai` |
| `STT_PROVIDER` | 음성 인식 | `openai` \| `local` \| `none` |
| `TTS_PROVIDER` | 음성 합성 | `openai` \| `elevenlabs` \| `none` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` | 키 | — |
| `LOCAL_STT_URL` | 로컬 whisper HTTP(`STT_PROVIDER=local`) | `http://127.0.0.1:8123/transcribe` |

**권장 조합** (근거는 리서치결과.md):
- 대화=Claude, 분석=OpenAI → 분석 LLM이 대화 LLM과 다른 벤더(8절 "자기 채점 금지").
- STT=OpenAI(`gpt-4o-transcribe`) 또는 로컬 mlx-whisper, TTS=OpenAI(품질 우선 시 ElevenLabs).

**키가 없어도** 돌아간다(품질은 낮아짐):
- LLM 키 없음 → 페르소나는 내장 폴백 풀에서. (검수 6은 키가 있어야 의미)
- `STT_PROVIDER=none` → 브라우저 Web Speech(Chrome 계열만) 또는 텍스트 모드.
- `TTS_PROVIDER=none` → 브라우저 SpeechSynthesis. ⚠️ 이 음성은 **녹음에 담기지
  않는다**(F1은 서버 TTS 경로에서만 완전). 아래 한계 참조.

### 로컬 whisper 연동 (`STT_PROVIDER=local`)

의뢰인의 `mlx-whisper` 파이프라인을 HTTP로 노출하면 API 비용 0에 최고 정확도.
`POST multipart(file)` → `{ "text": "..." }` 를 반환하는 엔드포인트면 된다.
`LOCAL_STT_URL` 로 지정.

---

## 아첨 방지 회귀 테스트 (명세 9절 / 검수 7)

```bash
npm test                    # 전체
npm run test:sycophancy     # 아첨만
```

- **정규식 게이트 테스트**는 키 없이 항상 돈다 — 금지 표현을 실제로 잡는지.
- **라이브 agreementRate 테스트**는 `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` 가 있을
  때만 실행된다. 동의를 유도하는 의견 6개를 최악 조건(`engaged`)에서 던지고,
  `agreementRate < 0.5` 와 금지표현 0회를 검증한다.

`agreementRate` 는 결과 화면 하단에도 매 세션 노출된다(앱 자체 검증 지표).

---

## 검수 기준(명세 14절)이 코드 어디에 있나

| # | 항목 | 위치 |
|---|---|---|
| F1 녹음 | 마이크+AI 한 파일 | `src/client/audio.ts` (`createRecorder`) |
| F2 다운로드 | 종료 후 | `src/components/ResultScreen.tsx` |
| F3 멀티턴 | 12턴 왕복 | `src/components/ConversationScreen.tsx` |
| F4 침묵 감지 | 5초·리셋·설정 | `src/client/vad.ts` (`SilenceDetector`) |
| F5 「다음」 | 즉시 넘김 | ConversationScreen `endUserTurn('button')` |
| F6 성격 | 세션마다 다른 페르소나 | `src/app/api/persona/route.ts`, `src/lib/persona.ts` |
| F7 아첨 | 게이트·재생성 | `src/lib/server/reply.ts`, `src/lib/sycophancy.ts` |
| D1 지표 6종 | 분석 | `src/app/api/analyze/route.ts`, `src/lib/prompts/analysis.v1.ts` |
| D2 반응성 | 중 비공개/후 공개 | 페르소나는 결과 화면에서만 공개 |
| D3·D4 | 코칭·평가 없음 | ConversationScreen(힌트 없음) / ResultScreen(평가문 없음) |
| 지연 | 3초 이내 | 실기기 측정 필요 (아래) |
| 12-3 | 임계값·카운트다운 | SetupScreen 슬라이더 + ConversationScreen 카운트다운 |

### 실기기에서 반드시 확인할 것 (이 저장소에서 자동 검증 못 함)

헤드리스 환경에서는 마이크·오디오·실지연을 못 잰다. 다음은 사람이 직접:
- **F1**: 녹음 파일에 내 목소리와 AI 목소리가 둘 다 들리는가(밸런스 포함).
- **12-2 에코**: AI 음성이 마이크로 되잡혀 VAD가 오작동하지 않는가.
- **지연**: 발화 종료 → AI 음성 시작까지 3초 이내인가.
- **F4**: 문장 중간에 잠깐 멈췄을 때 성급히 넘어가지 않는가(침묵 시간 조정).

---

## 지표 분석 프롬프트 버전 관리

`src/lib/prompts/analysis.v1.ts` 는 **버전 고정**이다. 판정 기준을 바꾸면 과거
세션 지표와 비교가 깨진다(명세 15절). 기준을 바꾸려면 `analysis.v2.ts` 를 새로
만들고 라우트에서 교체하라. 각 세션 결과에 `promptVersion` 이 표시된다.

---

## 알려진 한계 / 향후

- **SpeechSynthesis 폴백은 녹음에 담기지 않는다.** F1 완전 충족은 서버 TTS
  (`TTS_PROVIDER=openai|elevenlabs`) 경로에서만. 무키 데모용 폴백일 뿐.
- **VAD는 에너지(RMS) 기반 기본 구현**이다(라이브러리 통합 리스크 없이 확실히
  동작). 생각멈춤 오탐을 더 줄이려면 Silero(`@ricky0123/vad-web`)로 교체 권장 —
  `src/client/vad.ts` 의 `SilenceDetector` 인터페이스(`start/stop/pause/resume`,
  `onCountdown/onTurnEnd`)를 그대로 구현하면 드롭인된다. 리서치결과.md R-C 참조.
- **m4a 출력**: 브라우저 녹음 기본은 webm/opus. 창고 파이프라인이 m4a를 요구하면
  서버 ffmpeg 변환을 붙여라(파일명 규칙은 이미 `대화연습_YYYY-MM-DD_HHMM_시나리오명`).

## 파일 구조

```
src/
  app/
    page.tsx                  3화면 상태머신 (설정→대화→결과)
    api/persona|stt|turn|analyze/route.ts
  components/                 SetupScreen · ConversationScreen · ResultScreen · LimitationsNote
  client/                     audio(믹서·녹음) · vad(침묵감지) · api · speech(브라우저 폴백)
  lib/
    types.ts scenarios.ts persona.ts sycophancy.ts
    server/reply.ts           대화 응답 + 아첨 게이트(재사용/테스트 공유)
    providers/                llm · stt · tts (REST 추상화)
    prompts/                  conversation · sycophancy-judge · analysis.v1(버전 고정)
tests/sycophancy.test.ts      9절 회귀 테스트
리서치결과.md                  4절 6건 결론과 근거
```
