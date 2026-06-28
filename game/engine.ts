import { BALANCE, ROOM } from "./balance";
import { ROUND_PHASES, SECTORS } from "./types";
import type {
  ClientMessage,
  Declaration,
  GameState,
  Phase,
  PlayerState,
  Sector,
  ServerMessage,
} from "./types";

// 한 연결의 추상화. 전송 계층(ws 등)과 무관하게 게임 로직만 다룬다.
export interface Conn {
  id: string;
  send(data: string): void;
}

const SHARES_OUTSTANDING = 1000; // 전원 동일 → 시작 시총 동일 (price × shares)

// 글로벌 이벤트 헤드라인 (섹터 × 방향). SPEC 3.6 — 시장 전체 뉴스.
const HEADLINES: Record<Sector, { up: string[]; down: string[] }> = {
  IT_GAME: {
    up: ["AI 붐 — IT/게임 호조", "신작 흥행 — IT/게임 강세"],
    down: ["사이버 공격 — IT/게임 충격", "규제 강화 — IT/게임 침체"],
  },
  BEAUTY: {
    up: ["K뷰티 글로벌 인기 — 뷰티 호조", "한류 효과 — 뷰티 강세"],
    down: ["원료비 급등 — 뷰티 부진", "수출 둔화 — 뷰티 약세"],
  },
  CONSTRUCTION: {
    up: ["인프라 부양 — 건설 호조", "주택 공급 확대 — 건설 강세"],
    down: ["철근 가격 급락 — 건설 부진", "분양 미달 — 건설 약세"],
  },
  RETAIL: {
    up: ["소비 회복 — 유통 호조", "온라인 쇼핑 폭증 — 유통 강세"],
    down: ["물류 대란 — 유통 부진", "소비 위축 — 유통 약세"],
  },
  BIO: {
    up: ["신약 승인 — 바이오 호조", "R&D 보조금 확대 — 바이오 강세"],
    down: ["임상 실패 — 바이오 부진", "감염병 잠잠 — 바이오 약세"],
  },
  DEFENSE: {
    up: ["방산 수출 호조 — 방산 강세", "안보 긴장 고조 — 방산 호조"],
    down: ["방산 예산 삭감 — 방산 부진", "평화 협정 — 방산 약세"],
  },
};

function pickHeadline(sector: Sector, isUp: boolean): string {
  const list = HEADLINES[sector][isUp ? "up" : "down"];
  return list[Math.floor(Math.random() * list.length)];
}

// 거래량 → 주가 임팩트. shares > 0 은 매수(상승), < 0 은 매도(하락).
// 변동률 = priceImpactCoef × (체결주식 / sharesOutstanding)
function applyImpact(
  price: number,
  shares: number,
  sharesOutstanding: number
): number {
  if (sharesOutstanding <= 0) return price;
  const ratio = shares / sharesOutstanding;
  const newPrice = price * (1 + BALANCE.priceImpactCoef * ratio);
  return Math.max(1, Math.round(newPrice));
}

// 페이즈 진입 시 남길 로그 문구 (사람이 읽는 한 줄).
const PHASE_LOG: Record<Phase, string> = {
  SETUP: "사업 설립 — 카테고리/회사명 설정",
  INFO: "정보 페이즈 — 비공개 정보 수신",
  POSITION: "사전 포지션 페이즈 — 비공개 매매",
  DECLARE: "선언 페이즈 — 전망 카드 공개",
  TRADE: "거래 페이즈 — 제한시간 호가",
  SETTLE: "정산 페이즈 — 이벤트 발동/손익 정산",
  MANAGE: "관리 페이즈",
  LOBBY: "로비",
  ENDED: "게임 종료",
};

// 권위 게임 방 — SPEC.md 0장/2장/8장.
// 모든 게임 상태 계산과 페이즈 전환은 여기(서버)에서만. 전송 계층은 Conn 으로 주입된다.
export class GameRoom {
  state: GameState;
  private conns = new Map<string, Conn>();
  private tradeTimer?: ReturnType<typeof setTimeout>;

  constructor(roomCode: string) {
    this.state = {
      roomCode,
      phase: "LOBBY",
      round: 0,
      maxRounds: ROOM.defaultMaxRounds,
      hostId: "",
      players: [],
      companies: {},
      log: [],
    };
  }

  get connectionCount(): number {
    return this.conns.size;
  }

  // --- 연결 수명주기 ---

  addConn(conn: Conn) {
    this.conns.set(conn.id, conn);

    const known = this.state.players.find((p) => p.id === conn.id);
    if (known) {
      // 재접속: 같은 식별자면 즉시 연결 상태로 복귀.
      known.connected = true;
      this.broadcastSnapshot();
      return;
    }
    // 처음 보는 연결은 아직 플레이어로 등록하지 않는다. "join" 에서 등록.
    this.sendSnapshotTo(conn);
  }

  // 같은 conn 인스턴스일 때만 제거(재접속 레이스로 새 연결을 지우지 않도록).
  removeConn(conn: Conn) {
    if (this.conns.get(conn.id) !== conn) return;
    this.conns.delete(conn.id);

    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) return;
    player.connected = false;
    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  handleMessage(id: string, raw: string) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "join":
        this.handleJoin(id, msg.nickname);
        break;
      case "start":
        this.handleStart(id);
        break;
      case "setup":
        this.handleSetup(id, msg.sector, msg.name, msg.seedInvested);
        break;
      case "buyInfo":
        this.handleBuyInfo(id, msg.targetOwnerId);
        break;
      case "submitPosition":
        this.handleSubmitPosition(id, msg.orders);
        break;
      case "trade":
        this.handleTrade(id, msg.companyOwnerId, msg.shares);
        break;
      case "declare":
        this.handleDeclare(id, msg.declaration);
        break;
      case "ready":
        this.handleReady(id);
        break;
    }
  }

  // SPEC 2장 ①: 정보 페이즈에서 돈 내고 다른 회사 정보 1건 구매.
  // 본인 정보 외 추가, 최대 infoBuyMax 건. 본인에게만 보임.
  private handleBuyInfo(id: string, targetOwnerId: string) {
    if (this.state.phase !== "INFO") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (targetOwnerId === id) return; // 본인 정보는 이미 무료로 봄
    const target = this.state.players.find((p) => p.id === targetOwnerId);
    if (!target || !target.privateInfo) return;
    // 중복 구매 방지.
    if (player.purchasedInfos.some((x) => x.ownerId === targetOwnerId)) return;
    // 한도 체크.
    if (player.purchasedInfos.length >= BALANCE.infoBuyMax) return;
    // 현금 충분 확인.
    if (player.cash < BALANCE.infoBuyCost) return;

    player.cash -= BALANCE.infoBuyCost;
    player.purchasedInfos.push({
      ownerId: targetOwnerId,
      direction: target.privateInfo,
    });
    this.broadcastSnapshot();
  }

  // SPEC 2장 ②: 비공개 사전 포지션 제출.
  // 새 주문 배열로 기존 pendingPosition 을 통째로 덮어쓴다(수정 가능).
  // 가상 시뮬레이션으로 자기 자본/지분 제약 모두 검증한 뒤 통째로 받는다(부분 수용 X).
  private handleSubmitPosition(
    id: string,
    orders: Array<{ companyOwnerId: string; shares: number }>
  ) {
    if (this.state.phase !== "POSITION") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!Array.isArray(orders)) return;

    // 청결화: 정수, 0 주문 제거, 알 수 없는 회사 제거, 같은 회사 합치기.
    const merged = new Map<string, number>();
    for (const o of orders) {
      if (!o || typeof o.companyOwnerId !== "string") continue;
      const co = this.state.companies[o.companyOwnerId];
      if (!co) continue;
      const shares = Math.trunc(Number(o.shares) || 0);
      if (shares === 0) continue;
      merged.set(o.companyOwnerId, (merged.get(o.companyOwnerId) ?? 0) + shares);
    }
    const cleaned = Array.from(merged.entries())
      .filter(([, n]) => n !== 0)
      .map(([companyOwnerId, shares]) => ({ companyOwnerId, shares }));

    // 시뮬레이션: 자본/지분 제약 확인. 현재 가격 기준.
    let cash = player.cash;
    const simHoldings: Record<string, number> = { ...player.holdings };
    for (const o of cleaned) {
      const co = this.state.companies[o.companyOwnerId];
      const cost = o.shares * co.price; // +매수 +비용, -매도 -비용(=환매수익)
      cash -= cost;
      const after = (simHoldings[o.companyOwnerId] ?? 0) + o.shares;
      if (after < 0) return; // 보유보다 더 매도 불가
      if (
        o.companyOwnerId === id &&
        after > Math.floor(co.sharesOutstanding * BALANCE.maxSelfOwnership)
      ) {
        return; // 자기 회사 60% 상한
      }
      simHoldings[o.companyOwnerId] = after;
    }
    if (cash < 0) return; // 잔여 현금 음수 불가

    player.pendingPosition = cleaned;
    player.ready = true;
    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  // SPEC 2장 ④: 거래 페이즈 단건 즉시 체결.
  private handleTrade(id: string, companyOwnerId: string, shares: number) {
    if (this.state.phase !== "TRADE") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    const co = this.state.companies[companyOwnerId];
    if (!co) return;
    const n = Math.trunc(Number(shares) || 0);
    if (n === 0) return;

    const cost = n * co.price;
    const newCash = player.cash - cost;
    if (newCash < 0) return; // 잔액 부족

    const held = player.holdings[companyOwnerId] ?? 0;
    const after = held + n;
    if (after < 0) return; // 보유보다 더 매도 불가
    if (
      companyOwnerId === id &&
      after > Math.floor(co.sharesOutstanding * BALANCE.maxSelfOwnership)
    ) {
      return; // 자기 회사 60% 상한
    }

    player.cash = newCash;
    player.holdings[companyOwnerId] = after;
    // 주가 임팩트: +매수면 ↑, -매도면 ↓.
    co.price = applyImpact(co.price, n, co.sharesOutstanding);
    this.broadcastSnapshot();
  }

  // SPEC 2장 ③: HYPE/WARN/SILENT 1장 선언 + 준비 처리.
  private handleDeclare(id: string, declaration: Declaration) {
    if (this.state.phase !== "DECLARE") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (
      declaration !== "HYPE" &&
      declaration !== "WARN" &&
      declaration !== "SILENT"
    ) {
      return;
    }
    player.declaration = declaration;
    player.ready = true;
    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  // --- 입력 처리 ---

  private handleJoin(id: string, nickname: string) {
    const existing = this.state.players.find((p) => p.id === id);
    if (existing) {
      existing.nickname = nickname.trim().slice(0, 16) || existing.nickname;
      existing.connected = true;
      this.broadcastSnapshot();
      return;
    }

    if (this.state.phase !== "LOBBY") return;
    if (this.state.players.length >= ROOM.maxPlayers) return;

    const player: PlayerState = {
      id,
      nickname: nickname.trim().slice(0, 16) || "player",
      cash: 0,
      holdings: {},
      ready: false,
      seedInvested: 0,
      purchasedInfos: [],
      connected: true,
    };
    this.state.players.push(player);
    if (!this.state.hostId) this.state.hostId = id;

    this.broadcastSnapshot();
  }

  // 호스트만, 최소 인원 충족 시: 로비 → SETUP(사업 설립).
  private handleStart(id: string) {
    if (id !== this.state.hostId) return;
    if (this.state.phase !== "LOBBY") return;
    const connected = this.state.players.filter((p) => p.connected);
    if (connected.length < ROOM.minPlayers) return;

    // 회사는 SETUP 에서 각자 만든다. 여기서는 자본만 지급하고 초기화.
    this.state.companies = {};
    for (const p of this.state.players) {
      p.cash = BALANCE.startingCash;
      p.holdings = {};
      p.ready = false;
      p.declaration = undefined;
      p.privateInfo = undefined;
      p.pendingPosition = undefined;
      p.seedInvested = 0;
      p.purchasedInfos = [];
    }
    this.state.round = 0;
    this.state.log.push({ round: 0, text: "게임 시작 — 사업 설립" });
    this.enterPhase("SETUP");
  }

  // SETUP: 카테고리 + 회사명 + 창업 출자(seedInvested).
  // 시작 시총은 전원 동일(price × shares). 출자는 시총이 아니라 정산 시 성장 보너스로 환원된다.
  private handleSetup(
    id: string,
    sector: Sector,
    name: string,
    seedInvested: number
  ) {
    if (this.state.phase !== "SETUP") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!SECTORS.includes(sector)) return;

    // 출자 금액: 0 ~ seedInvestedMax 사이로 정수 클램프.
    const seed = Math.max(
      0,
      Math.min(BALANCE.seedInvestedMax, Math.floor(Number(seedInvested) || 0))
    );

    const cleanName = name.trim().slice(0, 20) || `${player.nickname} 사`;
    this.state.companies[id] = {
      ownerId: id,
      name: cleanName,
      sector,
      price: BALANCE.startingPrice,
      techLevel: BALANCE.startingTech,
      trust: BALANCE.startingTrust,
      sharesOutstanding: SHARES_OUTSTANDING,
      lieCount: 0,
      auditedThisRound: false,
      researchBreakthroughThisRound: false,
    };
    // 시작 자본에서 출자분만큼 차감(회차 1 시작 시 현금에 반영).
    player.cash = BALANCE.startingCash - seed;
    player.seedInvested = seed;
    player.ready = true; // 설립 완료 = 준비 완료

    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  // 현재 페이즈 입력 완료. TRADE 는 ready 를 무시(타이머만으로 전환).
  private handleReady(id: string) {
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!ROUND_PHASES.includes(this.state.phase)) return;
    if (this.state.phase === "TRADE") return;

    player.ready = true;
    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  // --- 페이즈 상태머신 (SPEC 2장) ---

  // 연결된 전원이 준비되면 다음으로. SETUP·라운드 페이즈(거래 제외) 공통 처리.
  private tryAdvanceOnReady(): boolean {
    const connected = this.state.players.filter((p) => p.connected);
    if (connected.length === 0) return false;

    if (this.state.phase === "SETUP") {
      // 전원이 사업 설립(회사 보유 + ready) 완료해야 1회차 시작.
      const allSetUp = connected.every(
        (p) => p.ready && this.state.companies[p.id]
      );
      if (!allSetUp) return false;
      this.state.round = 1;
      this.enterPhase("INFO");
      return true;
    }

    if (!ROUND_PHASES.includes(this.state.phase)) return false;
    if (this.state.phase === "TRADE") return false;
    if (!connected.every((p) => p.ready)) return false;
    this.advancePhase();
    return true;
  }

  private advancePhase() {
    const idx = ROUND_PHASES.indexOf(this.state.phase);
    if (idx === -1) return;

    if (idx < ROUND_PHASES.length - 1) {
      this.enterPhase(ROUND_PHASES[idx + 1]);
      return;
    }

    // SETTLE 종료 → 다음 회차 또는 게임 종료.
    if (this.state.round < this.state.maxRounds) {
      this.state.round += 1;
      this.resetRoundScopedFields();
      this.enterPhase("INFO");
    } else {
      this.endGame();
    }
  }

  private enterPhase(phase: Phase) {
    this.clearTradeTimer();
    this.state.phase = phase;
    for (const p of this.state.players) p.ready = false;

    if (phase === "INFO") this.onEnterInfo();
    if (phase === "TRADE") this.onEnterTrade();
    if (phase === "SETTLE") this.onEnterSettle();

    if (phase === "TRADE") {
      const ms = BALANCE.tradeWindowSec * 1000;
      this.state.phaseDeadline = Date.now() + ms;
      this.tradeTimer = setTimeout(() => this.onTradeTimeout(), ms);
    } else {
      this.state.phaseDeadline = undefined;
    }

    this.state.log.push({ round: this.state.round, text: PHASE_LOG[phase] });
    this.broadcastSnapshot();
  }

  // SPEC 2장 ①: 각자에게 자기 섹터 다음 이벤트 방향만 비공개로 지급. 강도는 SETTLE에서 결정.
  // 동시에 SPEC 3.6 글로벌 이벤트도 결정해 모두에게 공개(헤드라인). 적용은 SETTLE에서.
  private onEnterInfo() {
    for (const p of this.state.players) {
      p.privateInfo = Math.random() < 0.5 ? "BULLISH" : "BEARISH";
      p.declaration = undefined;
      p.purchasedInfos = [];
    }
    this.rollGlobalEvent();
  }

  // 평균회귀: 직전 회차 과열 섹터에 역풍 가중치 2배.
  private rollGlobalEvent() {
    const [lo, hi] = BALANCE.globalEventMagnitudeRange;
    const mag = lo + Math.random() * (hi - lo);

    // 섹터 가중치 테이블: 기본 1, 직전 핫 섹터는 역풍(반대 방향) 가중치 2.
    // 단순화를 위해 섹터를 먼저 뽑고, 그 섹터의 방향을 직전 핫 섹터에 대해서만 역풍으로.
    const sectors: Sector[] = [
      "IT_GAME",
      "BEAUTY",
      "CONSTRUCTION",
      "RETAIL",
      "BIO",
      "DEFENSE",
    ];
    const weights = sectors.map((s) =>
      this.state.lastHotSector && s === this.state.lastHotSector ? 2 : 1
    );
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let chosen: Sector = sectors[0];
    for (let i = 0; i < sectors.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosen = sectors[i];
        break;
      }
    }

    // 방향: 핫 섹터면 BEARISH(역풍) 우세, 아니면 50:50.
    const isUp =
      chosen === this.state.lastHotSector
        ? Math.random() < 0.3
        : Math.random() < 0.5;
    const signedMag = isUp ? mag : -mag;
    this.state.pendingGlobalEvent = {
      sector: chosen,
      magnitude: signedMag,
      headline: pickHeadline(chosen, isUp),
    };
    this.state.log.push({
      round: this.state.round,
      text: `🌐 [예고] ${this.state.pendingGlobalEvent.headline}`,
    });
  }

  // SPEC 2장 ④ 진입: POSITION 의 비공개 주문들을 일괄 체결한다.
  // 1) 각 플레이어의 pendingPosition 을 현재 가격에 체결(현금↔보유 갱신).
  // 2) 회사별 순 거래량을 모아 일괄 주가 임팩트 적용.
  // 3) pendingPosition 제거(= 공개됨).
  private onEnterTrade() {
    const netByCo = new Map<string, number>(); // companyOwnerId -> net shares
    for (const p of this.state.players) {
      if (!p.pendingPosition || p.pendingPosition.length === 0) continue;
      for (const o of p.pendingPosition) {
        const co = this.state.companies[o.companyOwnerId];
        if (!co) continue;
        const cost = o.shares * co.price;
        // 최종 검증: 만에 하나 가격이 바뀐 경우(여기선 정적이지만 방어적).
        if (p.cash - cost < 0) continue;
        const held = p.holdings[o.companyOwnerId] ?? 0;
        const after = held + o.shares;
        if (after < 0) continue;
        if (
          o.companyOwnerId === p.id &&
          after > Math.floor(co.sharesOutstanding * BALANCE.maxSelfOwnership)
        ) {
          continue;
        }
        p.cash -= cost;
        p.holdings[o.companyOwnerId] = after;
        netByCo.set(
          o.companyOwnerId,
          (netByCo.get(o.companyOwnerId) ?? 0) + o.shares
        );
      }
      p.pendingPosition = undefined;
    }
    // 일괄 임팩트.
    for (const [cid, net] of netByCo.entries()) {
      const co = this.state.companies[cid];
      if (!co || net === 0) continue;
      co.price = applyImpact(co.price, net, co.sharesOutstanding);
    }
  }

  // SPEC 2장 ⑤ + 1.1 + 3.6 + 3.7: 글로벌 이벤트 + 개인 이벤트 + 성장 보너스 +
  // 신뢰도 ±1 + 세무 조사 + 연구 잭팟. 매매는 TRADE 에서 이미 끝남.
  private onEnterSettle() {
    // 1) 글로벌 이벤트: 대상 섹터의 모든 회사 주가에 일괄 ±
    const ge = this.state.pendingGlobalEvent;
    const startPrices: Record<string, number> = {};
    for (const co of Object.values(this.state.companies)) {
      startPrices[co.ownerId] = co.price;
    }
    if (ge) {
      for (const co of Object.values(this.state.companies)) {
        if (co.sector === ge.sector) {
          co.price = Math.max(
            1,
            Math.round(co.price * (1 + ge.magnitude))
          );
        }
      }
      this.state.log.push({
        round: this.state.round,
        text: `🌐 ${ge.headline} ${(ge.magnitude * 100).toFixed(1)}%`,
      });
    }

    // 2) 개인 이벤트 + 신뢰도 + 감사 + 연구 (회사별 루프)
    for (const p of this.state.players) {
      const co = this.state.companies[p.id];
      if (!co) continue;
      co.auditedThisRound = false; // 매 정산마다 초기화
      co.researchBreakthroughThisRound = false;

      // 이벤트 강도 랜덤. 방향은 본인 privateInfo.
      const [lo, hi] = BALANCE.eventMagnitudeRange;
      const mag = lo + Math.random() * (hi - lo);
      const dir = p.privateInfo ?? "BULLISH";
      const eventDelta = dir === "BULLISH" ? mag : -mag;

      // 창업 출자 성장 보너스: 풀출자(seedInvestedMax)면 +seedGrowthMax, 비례.
      const seedRatio =
        BALANCE.seedInvestedMax > 0
          ? Math.min(1, p.seedInvested / BALANCE.seedInvestedMax)
          : 0;
      const seedBonus = BALANCE.seedGrowthMax * seedRatio;

      // 신뢰도 ±1 & 거짓 카운트 누적.
      // 진실 = 선언 방향이 실제 방향과 일치, 거짓 = 불일치, SILENT = 둘 다 아님.
      const isHype = p.declaration === "HYPE";
      const isWarn = p.declaration === "WARN";
      const isSilent = p.declaration === "SILENT";
      const isLie =
        (isHype && dir === "BEARISH") || (isWarn && dir === "BULLISH");
      const isTruth =
        (isHype && dir === "BULLISH") || (isWarn && dir === "BEARISH");

      let trustDelta = 0;
      if (isTruth) trustDelta = 1;
      else if (isLie) trustDelta = -1;
      // SILENT 는 0
      co.trust = Math.max(0, Math.min(5, co.trust + trustDelta));

      if (isLie) co.lieCount += 1;

      // 세무 조사 발동(거짓 임계 초과 시): 추가 악재 −auditPenalty%.
      let auditDelta = 0;
      if (co.lieCount >= BALANCE.auditLieThreshold) {
        const [alo, ahi] = BALANCE.auditPenaltyRange;
        const auditMag = alo + Math.random() * (ahi - alo);
        auditDelta = -auditMag;
        co.auditedThisRound = true;
        co.lieCount = 0; // 발동 후 누적 리셋(SPEC 3.7)
      }

      // 연구 성공 (SPEC 3.6.5): 출자에 비례한 낮은 확률 잭팟.
      let researchDelta = 0;
      const researchChance = BALANCE.researchBaseChance * seedRatio;
      if (researchChance > 0 && Math.random() < researchChance) {
        const [rlo, rhi] = BALANCE.researchBoostRange;
        researchDelta = rlo + Math.random() * (rhi - rlo);
        co.researchBreakthroughThisRound = true;
      }

      const prevPrice = co.price;
      // 합성 변동: 이벤트 + 성장보너스 + 세무 조사 + 연구 성공. 한 번에 곱.
      co.price = Math.max(
        1,
        Math.round(
          prevPrice * (1 + eventDelta + seedBonus + auditDelta + researchDelta)
        )
      );

      // 사람이 읽는 한 줄 로그.
      const pct = ((co.price / prevPrice - 1) * 100).toFixed(1);
      const dirLabel = dir === "BULLISH" ? "호재" : "악재";
      const trustText =
        trustDelta === 0
          ? isSilent
            ? "침묵"
            : "변동 없음"
          : `신뢰도 ${trustDelta > 0 ? "+" : ""}${trustDelta}`;
      this.state.log.push({
        round: this.state.round,
        text: `${co.name}: ${dirLabel} ${pct}% (${trustText})`,
      });
      if (co.auditedThisRound) {
        this.state.log.push({
          round: this.state.round,
          text: `🚨 ${co.name} 세무 조사 — 거짓 선언 누적 페널티 ${(auditDelta * 100).toFixed(1)}%`,
        });
      }
      if (co.researchBreakthroughThisRound) {
        this.state.log.push({
          round: this.state.round,
          text: `🔬 ${co.name} 연구 성공 — 극호재 +${(researchDelta * 100).toFixed(1)}%`,
        });
      }
    }

    // 3) 평균회귀 추적: 이번 회차 가장 가격 변동률(섹터 합)이 큰 섹터를 hot 으로 기록.
    const sectorChange = new Map<Sector, number>();
    for (const co of Object.values(this.state.companies)) {
      const start = startPrices[co.ownerId] ?? co.price;
      const rate = start > 0 ? (co.price - start) / start : 0;
      sectorChange.set(co.sector, (sectorChange.get(co.sector) ?? 0) + rate);
    }
    let hot: Sector | undefined;
    let hotAbs = 0;
    for (const [s, change] of sectorChange.entries()) {
      if (Math.abs(change) > hotAbs) {
        hotAbs = Math.abs(change);
        hot = s;
      }
    }
    this.state.lastHotSector = hot;

    // 4) 글로벌 이벤트 소비
    this.state.pendingGlobalEvent = undefined;
  }

  private onTradeTimeout() {
    if (this.state.phase !== "TRADE") return;
    this.advancePhase();
  }

  private endGame() {
    this.clearTradeTimer();
    this.state.phase = "ENDED";
    this.state.phaseDeadline = undefined;
    this.state.log.push({ round: this.state.round, text: "게임 종료" });
    this.broadcastSnapshot();
  }

  private resetRoundScopedFields() {
    for (const p of this.state.players) {
      p.declaration = undefined;
      p.privateInfo = undefined;
      p.pendingPosition = undefined;
      p.purchasedInfos = [];
    }
  }

  private clearTradeTimer() {
    if (this.tradeTimer) {
      clearTimeout(this.tradeTimer);
      this.tradeTimer = undefined;
    }
  }

  // --- 스냅샷 (개인화: 비공개 필드는 본인 것만) ---

  private personalizedState(viewerId: string): GameState {
    return {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === viewerId
          ? p
          : {
              ...p,
              privateInfo: undefined,
              pendingPosition: undefined,
              purchasedInfos: [],
            }
      ),
    };
  }

  private sendSnapshotTo(conn: Conn) {
    const message: ServerMessage = {
      type: "snapshot",
      state: this.personalizedState(conn.id),
      selfId: conn.id,
    };
    conn.send(JSON.stringify(message));
  }

  private broadcastSnapshot() {
    for (const conn of this.conns.values()) {
      this.sendSnapshotTo(conn);
    }
  }
}
