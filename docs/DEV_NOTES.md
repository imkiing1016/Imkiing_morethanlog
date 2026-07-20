# 개발 노트: 왜 이렇게 짰나

이 문서는 세션 중 이뤄진 판단·근거·대안을 기록해 나중에 유사한 상황에서
"그때 왜 그렇게 갔지?" 라고 스스로 답할 수 있게 만든 학습용 메모다.

각 섹션은 세 가지를 담는다:

- **WHY** — 왜 이 결정을 내렸는가 (배경/제약/트레이드오프)
- **WHAT** — 결과적으로 무엇을 만들었는가 (구체 코드/구조)
- **ALT** — 만약 상황이 달랐다면 어떤 대안을 골랐을까

---

## 0. 큰 그림: 왜 이 아키텍처인가

### WHY

세 가지 제약이 아키텍처를 결정했다:

1. **속임수 게임의 본질** — 클라이언트가 게임 상태를 계산하면 위·변조가 가능하다.
   "다른 사람 privateInfo를 몰래 보기" 같은 치팅이 개발자 콘솔 한 줄로 뚫린다.
2. **실시간성** — 매매/선언/거래 페이즈가 초 단위로 흐른다. HTTP polling은 부담이 크고 응답 지연이
   심리전 재미를 죽인다.
3. **낮은 운영 비용** — 개인 프로젝트라 인프라를 최소화해야 한다.

### WHAT

**서버 권위 WebSocket** 구조로 갔다:

```
클라 (Next.js + Zustand)         서버 (Node ws + GameRoom 클래스)
   │                                    │
   │  { type: "trade", shares: +10 } →  │
   │                                    │ (검증 + 상태 변경)
   │  ← { type: "snapshot", state: … }  │
   │                                    │
   │  (Zustand store 갱신)              │
   │  (React 리렌더)                    │
```

- 모든 게임 로직/계산은 서버(`game/engine.ts` 의 `GameRoom` 클래스) 안에서만 수행
- 클라는 **입력만 전송하고 스냅샷을 받아 그리는 역할**
- 스냅샷은 뷰어별로 개인화(`personalizedState`) — 남의 `privateInfo`는 애초에 클라로 안 보냄
- 배포: 웹 → Vercel, WebSocket 서버 → Render (`render.yaml` + `DEPLOY.md`)

### ALT

- **Firebase / Supabase** — DB 트리거로 상태 동기화 가능하지만 실시간 상태 머신을 SQL/NoSQL로
  구축하는 게 오히려 복잡. 게임 로직이 "함수 호출"이 아닌 "행 삽입"이 되어 코드 가독성 하락
- **REST + polling** — 250ms 이하 반응성 확보 어렵고, 서버 부하도 커짐
- **Cloudflare Durable Objects** — 방 = Object 매핑이 자연스러움. 규모 커지면 검토할 만함
- **partykit** — 원래 partysocket을 클라로 쓰는 것에서 알 수 있듯 초기 후보였음. 자체 서버로
  간 이유는 로컬 개발 편의성 + Render 무료 티어로 충분해서

---

## 1. 엑시트 시스템 개편 (PR #2)

### WHY 원안 폐기

원래는 "**경매 매물 등록 → 다른 플레이어가 입찰**" 방식이었다. 실제 플레이에서 실패:

- 회사 시총이 크면(초기 1천만원 × N배) 개인 자본으로 못 낙찰
- 경매 페이즈가 별도로 필요 → 게임 시간 늘어남
- 낙찰 실패 시 매도자만 시간 낭비
- 관망 플레이가 최적 전략이 되어 아무도 참여 안 함

### WHAT

**두 경로**로 개편:

1. **국가 매각** — 시장가 × 50%, 즉시 확정. 확실하지만 아쉬운 가격
2. **NPC 인수 제안** — 매 관리 페이즈마다 확률 발생, 5종 인수자 (매파/헤지/재벌/VC/미스터리)
   각자 다른 가격 범위와 조건 (예: VC는 신뢰 ★4+ 이면서 기술 Lv3+ 만 노림)

매각 후 판매자는 **투자자 모드**로 전환:
- 회사 없음 → 대신 매턴 랜덤 회사 인사이더 정보 무료 지급
- 매매만 가능, 500만원/회차 매수 한도 + 이익세 20%

**부활 IPO** — 투자자가 5백만원으로 새 회사 창업 가능 (남은 회차 ≥ 3)

### 핵심 코드 위치

- `game/logic/exit.ts` — `executeCompanyExit`, `generateExitOffers`
- `game/balance.ts` → `exitBuyers`, `nationBuyoutRate`, `ripple`
- 매각 시 자동 청산 로직: 다른 홀더 = 매각가/총주식 × 지분

### ALT

- **경매 유지 + 국가 추가** — 유저에게 선택지를 더 주는 방향. 하지만 UI 복잡도 폭발
- **홀더 투표제** — 회사 매각 시 주주 과반 동의 필요. 게임 페이즈 늘어남, 스몰그룹에 부적합
- **낙찰가 = 시장가 × 랜덤 계수** — 판매자 선택권 없어져 재미 반감

---

## 2. 엑시트 연출 (PR #3 · SpotlightModal)

### WHY

큰 이벤트를 뉴스 팝업(우측 상단 작은 카드) 로만 알리면 **놓치기 쉽다**.
회사 매각·부활 IPO는 게임 흐름을 뒤엎는 순간이라 강한 임팩트가 필요.

### WHAT

**`SpotlightModal.tsx`** — 서버가 `spotlight: true` 뉴스를 push 하면 클라가 큐로 잡아채
**전 화면 중앙 오버레이 3.5초**로 표시:

- 4가지 톤 (`celebration` / `hostile` / `somber` / `rebirth`) 별 다른 색·컨페티 이모지
- 큐 처리로 동시 다발 매각도 순차 노출
- 인수자별 **flavor 대사 랜덤 (3종씩 총 21개)**: "네 섹터 자체를 갈아엎어 주지" 등
- 압류 확정 시 **회전하며 등장하는 붉은 도장** (`.foreclosure-stamp` 애니메이션)

### 데이터 흐름 트릭

기존 `newsEvents` 배열에 옵션 필드 몇 개만 추가:
```typescript
interface NewsEvent {
  // 기존 필드…
  spotlight?: boolean;
  flavorQuote?: string;
  spotlightTone?: "celebration" | "hostile" | "somber" | "rebirth";
}
```

`NewsFeed` 컴포넌트는 spotlight 이벤트를 필터링해서 팝업 스택엔 안 뜨게 하고,
`SpotlightModal` 이 그것만 골라서 렌더. **하나의 데이터 소스, 두 개의 다른 렌더**.

### ALT

- **별도 이벤트 채널** — `state.spotlightEvent?: {…}` 신규 필드. 프로토콜 확장 필요.
  기존 뉴스 배열에 얹은 것보다 구조는 깔끔하지만 코드 변경량 큼
- **소리 효과** — 브라우저 자동 재생 정책 때문에 유저 상호작용 필요. UX 저해
- **진동** — 모바일만 가능. 데스크탑 소외

---

## 3. 정산 종합 보드 + 프라이버시 원칙 (PR #3)

### WHY 총자산 은닉

원래 매턴 SETTLE 화면에 모든 플레이어 총자산을 보여줬음. 실제 유저 피드백:
"몇 등인지 다 보이니 이미 결과 정해진 느낌, 심리전 재미 없음."

포커에서 상대방 칩 개수는 봐도 되지만 카드는 안 보이듯,
**"활동 정보"는 공개하되 "총합"은 숨기는** 원칙 채택.

### WHAT

**공개**: `roundTradesCashFlow` (이번 회차 매도 대금 − 매수 대금)
- 양수면 순매도 (현금화), 음수면 순매수 (레버리지)
- **행동은 보이지만 총액은 안 보임**

**은닉**: 각 플레이어의 현금 · 주식 평가액 · 총자산

정산 보드 4구획:
1. 🌡️ 최종 종가 + 회사 분위기 이모지 (🔥폭등/📈/➡️/📉/💀)
2. 📰 이번 회차 뉴스 (`newsEvents.round === state.round` 필터)
3. 🔬 연구·기술 성과 (성공/실패)
4. 💰 매매 순손익 랭킹 (🥇🥈🥉 상위 3인)

### 서버 필드

- `newsEvents[].round` — 회차 태그, `pushNews` 자동 스탬프
- `PlayerState.roundTradesCashFlow` — 매매 시마다 누적, INFO 진입 시 0 리셋

### ALT

- **부분 은닉** — 자산 규모만 rough하게 표시 ("상위 20%") — 계산 복잡, 정보량 여전
- **완전 공개** — 원안. 재미 반감
- **완전 은닉** — 매매 흐름도 감춤. 서로 뭘 하고 있는지 몰라 게임 상호작용 사라짐

---

## 4. 은행 시스템 (PR #4)

### WHY 원안 폐기 (재검토 후 자정)

원안은 "1금융권 · 산업은행 · 사채 3종" + "원금 > 회사가치 시 압류" 였다.
시뮬레이션 돌리기 전에 **논리적으로 검토**해서 문제 발견:

1. **담보 개념 붕괴** — 회사 시총 100억, 대출 3천만원 = 시총의 0.03%. 압류 조건 절대 발동 안 함
2. **은행 3종 매력 없음** — 담보가 무의미하면 회사보증 = "더 많이 빌리는 옵션" 뿐
3. **매각 시 처벌 위험** — "매각가 < 대출 원리금이면 판매자 현금에서 추가 차감" 규칙이
   엑시트 매력을 죽임

### WHAT

**은행 1개로 통합**, 신뢰도 기반 이자율/한도 (기존 신뢰 시스템 재활용):

| 신뢰도 ★ | 한도 | 이자율/턴 |
|---|---|---|
| ★5 | 3천만 | 3% |
| ★3 | 3천만 | 7% |
| ★0 | 1천만 | 17% |

**압류 조건을 단순화**: 지분가치·시총 비교 안 함. **이자 미납 3회 연속 = 압류**.
- 1회 미납: 주가 −3~7%, 신뢰 −1, 뉴스 공개
- 2회 미납: 마진콜 배너 + 원터치 즉시 상환 버튼
- 3회 미납: 압류 + 스포트라이트 (BANK 톤, 압류 딱지)

**매각 시**: 대출 우선 상환, **부족분은 은행이 흡수**(탕감). 판매자 기존 현금은 손대지 않음
→ 파산 방지 + 엑시트 매력 유지

### 투자자 특권/제약

- 500만원/회차 매수 한도
- 매매 이익세 20% (roundTradesCashFlow > 0 일 때 SETTLE에서 자동)
- 대출 불가 (담보 없으니)

### ALT

- **사채업자 추가** — 20~30% 고이자 + 신용점수 감소. v2로 미룸 (인지 부담 우려)
- **신용점수 별도 관리** — 신뢰도랑 겹침. 시스템 두 개 유지 부담
- **압류 조건 시총 기반** — 계산 필요, 유저가 언제 압류될지 예측 불가 → 재미 아니라 불안

---

## 5. 뉴스 히스토리 (PR #4 · 📢 확성기)

### WHY

뉴스 팝업이 6초 후 자동 dismiss 되니 놓치면 확인 방법이 없음.
전 게임 히스토리 아카이브가 필요.

### WHAT

**`NewsHistoryButton.tsx`** — 우측 상단 확성기 버튼:

- 총 뉴스 건수 배지
- 클릭 시 **우측 사이드 패널 슬라이드 인** (260ms)
- 회차별 그룹핑, sticky 회차 헤더
- 스포트라이트 이벤트는 노란 링으로 강조 + flavorQuote 회고 가능

**NewsFeed 팝업 위치 조정** — top-3 → top-16 으로 밀어서 버튼과 시각 충돌 방지.

### ALT

- **로그 섹션에 통합** — 텍스트 로그(현재 하단 진행 로그)와 뉴스는 톤이 다름. 분리 유지
- **왼쪽 사이드 슬라이드** — 오른쪽 스포트라이트와 충돌 우려. 우측 유지가 자연스러움

---

## 6. 특별 이벤트: 5회차 레버리지 · 7회차 블랙스완 (PR #6)

### WHY

시뮬레이션 결과 평균 8회차 게임의 최종 시총 중앙값 1.48배. **밋밋해서 극적 순간이 없음.**
게임에 "판을 뒤엎는" 이벤트가 필요.

### WHAT

**5회차 🎢 레버리지 데이**
- 4회차 SETTLE 종료 시 예고 스포트라이트
- 5회차 INFO 진입 시 배수 결정 (2/2.5/3 배 가중치 50/30/20%)
- 5회차 SETTLE 최종 주가 변동률에 배수 적용 (상승/하락 대칭)

**7회차 🌩️ 블랙스완** (5종 균등 20%):
- 🧟 좀비 바이러스 대유행 — 전 회사 −30~50%, 신뢰 −1
- 🎰 비트코인 초광풍 — 전 회사 +30~50%, 신뢰 +1
- ☄️ 메테오 낙하 — 특정 섹터 −50~70%, 나머지 −5~15%
- 👽 외계인 독점 계약 — 특정 섹터 +50~80%, 나머지 −5~15%
- 🎪 혼돈의 밈 폭발 — 회사별 개별 −40~+50%

### 코드 구조

`game/logic/bigEvents.ts` 신규 모듈. 두 훅:

```typescript
// INFO 진입 시 (engine.onEnterInfo → rollSpecialEventsOnInfo)
export function rollSpecialEventsOnInfo(state, pushNews, sectorLabels) {
  if (state.round === BALANCE.leverageEventRound) {
    state.pendingLeverage = pickLeverageMultiplier();
    pushNews(…, { spotlight: true });  // 예고
  }
  if (state.round === BALANCE.bigEventRound) {
    state.pendingBigEvent = rollBigEvent(state);
    pushNews(…, { spotlight: true });  // 예고
  }
}

// SETTLE 에서 (engine.onEnterSettle 안에서)
// 1) 블랙스완 있으면 그것만 적용, 기존 GlobalEvent 스킵
// 2) 다른 delta 모두 반영 후 마지막에 레버리지 배수
applyBigEventOnSettle(state, pushNews, sectorLabels);
// … 개인 이벤트 · 신뢰도 · 감사 · 연구 처리 …
applyLeverageOnSettle(state, pushNews);
```

**핵심 트릭**: 레버리지는 **최종 계산된 변동률에 곱**한다. 각 delta에 배수 곱하면 계산이
꼬이니, `co.price / co.prevSettlePrice - 1` 을 다시 계산해서 배수 적용.

### 재미 있는 컨셉 유지

사용자가 명시적으로 요청: "하늘에서 메테오가 떨어져 섹터가 붕괴, 좀비 바이러스, 등등"
→ 단순한 % 변동이 아니라 **서사가 있는 이벤트**로 만들었다.

### ALT

- **참여 선택제** — 유저가 레버리지 참여 여부 선택. 재밌지만 UI 복잡, 소극 플레이 나옴
- **랜덤 회차 이벤트** — 매 회차 확률 발생. 예측 불가 → 대응 여지 없음
- **개인 이벤트만 증폭** — "레버리지 = 내 회사 주가 변동만 배수". 시장 전체 판보다 좁은 재미

---

## 7. 리팩토링: God Class 해체 (PR #5)

### WHY

`components/GameView.tsx` 2,100줄, `game/engine.ts` 1,832줄. 특히 GameView는 페이즈 8개 UI가
if-else 로 붙어있어 **한 페이즈 손대려면 다른 페이즈 코드까지 스크롤**해야 함.
merge conflict 자주 발생, 온보딩 지옥.

### WHAT

**P1: GameView 분할** (2,100 → 140줄)

각 페이즈를 개별 파일로:
- `components/phases/SetupView.tsx`, `InfoView.tsx`, `PositionView.tsx`, `DeclareView.tsx`,
  `TradeView.tsx`, `SettleView.tsx`, `ManageView.tsx`, `EndedView.tsx`
- 로컬 폼 상태를 부모에서 자식으로 이동 (예: `positionOrders` 는 `PositionView` 안에서만 관리)
- `phases/phaseCommon.ts` 에 공통 props 타입 `PhaseViewProps` 정의

**GameView는 라우터** — phase 값 보고 해당 컴포넌트 렌더 + 카운트다운 tick + 관전 모드 가드만.

**P2: engine.ts 분할** (1,832 → 1,406줄)

도메인별 모듈:
- `game/logic/pricing.ts` — `setPriceAndRecord`, `applyImpact` (순수 함수)
- `game/logic/exit.ts` — `executeCompanyExit`, `generateExitOffers` (state + pushNews 콜백 인자)
- `game/logic/bank.ts` — `processBankingSettle` (state + pushNews 콜백)
- `game/logic/bigEvents.ts` — 5/7회차 이벤트
- `game/logic/rankings.ts` — `computeFinalRankings`
- `game/logic/exitBuyers.ts`, `headlines.ts` — 데이터 상수

`GameRoom` 는 얇은 코디네이터로 남고, 실제 로직은 위임 래퍼:

```typescript
// engine.ts (얇은 클래스)
private processBankingSettle() {
  processBankingSettle(this.state, this.pushNewsCallback());
}
```

### 콜백 주입 패턴

로직 모듈이 `this` 에 묶여있으면 재사용/테스트 어려움. 대신 **함수 파라미터로 서비스 주입**:

```typescript
// logic/bank.ts
export type PushNewsFn = (emoji, headline, detail, tone, extras?) => void;

export function processBankingSettle(
  state: GameState,
  pushNews: PushNewsFn
) { /* … */ }
```

GameRoom에서 `this.pushNews.bind(this)` 대신 클로저 반환:
```typescript
private pushNewsCallback(): PushNewsFn {
  return (emoji, headline, detail, tone, extras) =>
    this.pushNews(emoji, headline, detail, tone, extras);
}
```

이러면 로직 모듈은 순수 함수처럼 테스트 가능 (Mock `pushNews` 주입).

**P3~P5**: 공용 타입 이름화 (NewsEvent, ExitOffer 등), 헬퍼 추출 (`clampTrust`,
`computeStocksValue`, `getManageContext`), 매직 상수를 balance.ts로 이동.

### ALT

- **EngineContext 객체 주입** — `interface EngineContext { pushNews, broadcastSnapshot, … }`
  각 함수에 `ctx: EngineContext` 인자. 서비스 늘어나면 시그니처 계속 확장됨. 지금은 pushNews만
  있으면 되니 최소로
- **이벤트 버스** — 로직이 `emit("news", …)` 하면 GameRoom이 subscribe. 더 느슨한 결합이지만
  타입 안전성 하락, 흐름 추적 어려움
- **부분 분할** — 큰 함수만 뽑고 나머지 유지. 지금 접근이 균형
- **완전 함수형 재작성** — Redux 스타일 (state, action) → new state. 매력적이지만 대규모 재작성

### 리팩토링 원칙

1. **행동 무변경** — tsc/build 매 단계 통과, 게임 로직/UI 100% 동일 유지
2. **파일당 단일 책임** — 도메인 하나 (bank, exit, pricing 등)
3. **로컬 상태는 로컬로** — 폼 상태를 부모에서 관리하지 말 것 (SetupView의 sector/bizName)
4. **콜백으로 서비스 주입** — this 의존 최소화

---

## 8. 밸런스 튜닝: 시뮬레이터 기반 (PR #6)

### WHY

"이 이자율 적당한가?" 같은 질문에 **눈대중은 위험**. 8회차 복리 계산은 직관에 반한다:
- 5%/턴 × 8회차 복리 = 1.48배 (감당 가능)
- 20%/턴 × 8회차 복리 = **4.30배** (파산)

실제 플레이 없이 감으로 조정하면 여러 판 돌린 뒤에야 문제 발견.

### WHAT

**scratchpad/sim.mjs** — Node 스크립트로 Monte Carlo 10,000회 게임 시뮬레이션:

```
============================================
1) 은행 대출 · 8회차 이자만 상환 시나리오
============================================
★5   5%     30,000,000원   1,500,000원   총이자 12,000,000원   시작자본 대비 120%
★3  10%     30,000,000원   3,000,000원   총이자 24,000,000원   시작자본 대비 240%
★0  22%     10,000,000원   2,200,000원   총이자 17,600,000원   시작자본 대비 176%

파산율 (0.5배 미만): 2.8%
대박율 (3배 이상)  : 10.4%
```

각 조정마다 시뮬 재실행 → 결과 표 보고 판단.
사용자에게 "이 값으로 갈까요?" 확인 후 balance.ts 반영.

### 발견한 문제

- **연구 순 EV 마이너스**: 시총 1천만 기준 T0=−37.5만, T1=−157.5만, T2=−267.5만
  → 아무도 초반 연구 안 함
  → 비용 반값 조정 (T0: 100만→50만 등)
- **NPC 인수 확률 과함**: 종반 ★3+/Lv3+ 74~90% → 매턴 매각 가능한 수준
  → base 30% → 15% 로 하향

### ALT

- **A/B 실제 플레이** — 진짜 사람들과 여러 판. 시간 오래 걸리고 균형 데이터 얻기 어려움
- **손계산** — 복리·확률 계산 실수 잦음. 스크립트가 안전
- **밸런스 없이 무한 소프트런치** — 첫 인상 나쁘면 재접속 안 함

---

## 9. 프라이버시 · 스토리지 정책 (SPEC 8장)

### WHY

플레이어 식별을 localStorage/sessionStorage에 저장하면 두 가지 문제:
1. 다른 사람이 같은 브라우저 쓰면 그 사람으로 접속됨 (게임방 컴퓨터/공용 PC 시나리오)
2. "친구와 계정 바꿔치기" 같은 치팅 가능

### WHAT

**게임 식별자는 메모리(`useRef`)에만 보관**:

```typescript
// lib/usePartyRoom.ts
const connIdRef = useRef<string>(makeConnId());  // crypto.randomUUID
```

이 정책의 대가: **F5 새로고침 = 새 플레이어로 취급 → 관전 모드**로 튕김.

### 재접속 시나리오

| 상황 | 결과 |
|---|---|
| Wi-Fi 잠깐 끊김 | PartySocket 자동 재연결 → 원래 자리로 복귀 ✅ |
| 백그라운드 이동 | 소켓 유지, 자동 재연결 ✅ |
| **탭 닫기 / F5** | 새 connId → 관전 모드 ❌ |

**서버 측**: `addConn` 에서 같은 id의 기존 플레이어 있으면 즉시 `connected = true`로 복귀.

### 디버그 게이팅 (PR #7)

**"게임 상태" 는 저장 금지, "개발 편의성 플래그" 는 sessionStorage 허용** 으로 해석 유연하게:

```typescript
// components/DebugPanel.tsx
if (params.get("debug") === "1") {
  sessionStorage.setItem("_debugEnabled", "1");  // 세션 안에서만
  setEnabled(true);
}
```

URL `?debug=1` 로 진입한 사람만 🐞 버튼 노출. 친구에게 방 링크 공유 시 파라미터 안 붙이면
그들은 디버그 못 봄. **UI 접근성은 URL로 게이팅, 로그 수집은 백그라운드 상시 유지** —
필요할 때 즉시 열람 가능.

### ALT

- **서버 세션 토큰** — 서버가 발급한 토큰을 클라 쿠키에 저장. HttpOnly 쿠키라 스크립트 조작 못 함.
  구현 부담 크고, WebSocket 재연결 시에도 쿠키 자동 전송돼 이점 있음. 오버킬
- **정식 로그인** — Google OAuth 등. 진지한 프로덕트라면 이것. 캐주얼 방-공유 게임엔 마찰
- **닉네임 기반** — 닉네임으로 식별. 중복/변조 위험 커서 부적합

---

## 10. 회고: 실수·오해했던 것들

### 원격 컨테이너 오해

로컬에서 `npm run dev` 로 서버 띄운 뒤 "브라우저로 접속하세요" 라고 안내한 실수.
사실 이 세션은 원격 컨테이너에서 실행되고 `localhost:3000` 은 사용자 브라우저에서 접근 불가.

**교훈**: 개발 환경(로컬 vs 원격)을 항상 확인. 배포된 URL을 먼저 물어봤어야 함.

### feature/game 브랜치 잔재

Render가 초기에 `feature/game` 브랜치 추적하도록 세팅되어 있었고, 이후 개발은 `main`에만
반영됨. 결과적으로 배포된 서버가 5개월 전 코드로 실행 중일 위험이 있었음.

**해결**: 세션 마지막에 `feature/game` 을 `main`으로 fast-forward push 해서
Render 브랜치 설정과 무관하게 동일 코드 배포되게 만듦.

**교훈**: 배포 브랜치 이력을 관리할 때 fast-forward 유지가 이 문제를 예방.

### 리팩토링 중 브랜치 divergence

작업 브랜치(`claude/…`)에서 커밋한 후 main에 squash 머지되면, 로컬 브랜치의 원본 커밋과
main의 squash 커밋이 다른 SHA를 갖는다. 다음 PR 만들 때 non-fast-forward 충돌.

**해결 패턴**:
```bash
git fetch origin main
git reset --hard origin/main   # main 최신으로 리셋
git cherry-pick <새 커밋들>     # 새 작업만 얹기
git push --force-with-lease    # 안전한 강제 푸시
```

### 은행 원안 설계 실수

담보·시총 스케일 미스매치를 사용자가 지적하기 전엔 인지 못 함.
"3천만원 대출을 100억 시총 회사에 담보로" — 현실 은행 관점에선 성립 자체가 안 되는 구조.

**교훈**: 게임 밸런스 설계 시 **극단값 넣어보기**를 먼저 해야 함. 시총 1억 vs 100억,
이자율 1% vs 30% 등 경계 넣어서 UX 상상해보기.

---

## 11. 반복적으로 나타난 판단 패턴

세션 동안 여러 번 마주친 결정 패턴들. 나중에 유사한 상황에서 재적용 가능.

### 패턴 1: 예고 + 실행 분리

새 이벤트 도입 시 **예고 → (준비 시간) → 실행** 순서로 설계.

- 인수 제안 도착 → 관리 페이즈 카드로 예고 → 유저 선택
- 5회차 레버리지 → INFO 진입 시 예고 스포트라이트 → SETTLE 실행
- 블랙스완 → 예고 → 4개 페이즈 준비 시간 → 실행

이유: 갑작스러운 대변동은 유저 불만. 예고는 극적 순간을 더 크게 만듦.

### 패턴 2: 데이터 하나, 렌더 여러 개

`newsEvents` 배열 하나로:
- 우측 팝업 (`NewsFeed`)
- 스포트라이트 모달 (`SpotlightModal`, spotlight=true 필터)
- 사이드 히스토리 (`NewsHistoryButton`)
- 정산 보드 (`SettleView`, round 필터)

**단일 소스, 다양한 뷰**. 프로토콜 확장 최소화.

### 패턴 3: 클로저로 상태 접근 우회

로직 모듈이 GameRoom 인스턴스에 접근 안 하게 함수 파라미터로 서비스 주입.
콜백 클로저 하나로 `this` 바인딩 우회.

### 패턴 4: 시뮬 → 조정 → 시뮬

밸런스 판단 시 매 조정 후 재시뮬. 결과 표 유저에게 보이고 확인 받은 뒤 반영.
"감으로 조정" 대신 "데이터 보고 조정".

### 패턴 5: 옵션 필드 확장 vs 신규 필드

기존 인터페이스에 `?:` 옵션 필드 추가로 대부분 커버.
새 인터페이스 만드는 건 도메인이 완전히 다를 때만 (예: `PendingBigEvent` 는 기존
`PendingGlobalEvent`와 구조가 달라서 신규).

---

## 12. 이 코드베이스를 처음 볼 사람에게

만약 팀원이 새로 들어와서 이 프로젝트를 이어받는다면 읽는 순서:

1. **`README.md`** — 게임이 뭔지 (한 줄 요약)
2. **`SPEC.md`** — 게임 규칙 (단일 진실 원천)
3. **`docs/DEV_NOTES.md`** ← 이 문서. 각 판단의 배경
4. **`game/types.ts`** — 데이터 모델 (GameState, PlayerState, Company, NewsEvent 등)
5. **`game/balance.ts`** — 모든 수치 상수. 여기 값 조정으로 게임 튜닝
6. **`game/engine.ts`** — GameRoom 클래스. 페이즈 상태 머신 + 메시지 라우팅
7. **`game/logic/*.ts`** — 도메인 로직 (exit, bank, bigEvents, pricing 등)
8. **`components/GameView.tsx`** — 페이즈 라우터 (140줄, 얇음)
9. **`components/phases/*.tsx`** — 각 페이즈 UI (여기부터는 필요할 때만)

**밸런스만 조정하고 싶으면**: `game/balance.ts` 만 보면 됨. 나머지는 손댈 필요 없음.

**새 매커니즘 추가할 때 패턴**:
1. `types.ts` 에 필드/메시지 추가
2. `balance.ts` 에 상수
3. `game/logic/` 에 새 모듈 or 기존 모듈 확장
4. `engine.ts` 라우팅에 훅 걸기
5. `components/phases/` 해당 UI에 접목
6. `scratchpad/sim*.mjs` 로 시뮬 (있으면)

---

## 부록 · 배포 자원

- **웹 프로덕션**: https://imkiing-morethanlog.vercel.app
- **WebSocket 서버**: `imkiing-morethanlog.onrender.com`
- **레포**: https://github.com/imkiing1016/Imkiing_morethanlog
- **디버그 모드 켜기**: URL 뒤에 `?debug=1` 또는 `Ctrl+Shift+D`
- **Render 무료 티어**: 15분 유휴 시 sleep → 첫 접속 30~60초 콜드 스타트
