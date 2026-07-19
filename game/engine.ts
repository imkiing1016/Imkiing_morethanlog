import { BALANCE, NEWS_LIMIT, ROOM, SHARES_OUTSTANDING } from "./balance";
import { ROUND_PHASES, SECTORS, SECTOR_LABELS } from "./types";
import { clampTrust, computeStocksValue, getManageContext } from "./helpers";
import { pickHeadline } from "./logic/headlines";
import { applyImpact, setPriceAndRecord } from "./logic/pricing";
import { executeCompanyExit, generateExitOffers, type PushNewsFn } from "./logic/exit";
import { processBankingSettle, loanLimitFor, loanRateFor } from "./logic/bank";
import { computeFinalRankings } from "./logic/rankings";
import {
  applyBigEventOnSettle,
  applyLeverageOnSettle,
  rollSpecialEventsOnInfo,
} from "./logic/bigEvents";
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

let nextNewsId = 1;

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
  private noiseTimer?: ReturnType<typeof setInterval>;

  constructor(roomCode: string) {
    this.state = {
      roomCode,
      phase: "LOBBY",
      round: 0,
      maxRounds: ROOM.defaultMaxRounds,
      hostId: "",
      players: [],
      companies: {},
      exitOffers: [],
      newsEvents: [],
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
      case "addBot":
        this.handleAddBot(id);
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
        this.handleDeclare(id, msg.declaration, msg.comment);
        break;
      case "techUpgrade":
        this.handleTechUpgrade(id);
        break;
      case "research":
        this.handleResearch(id, msg.tier);
        break;
      case "pivot":
        this.handlePivot(id, msg.newSector);
        break;
      case "sellToNation":
        this.handleSellToNation(id);
        break;
      case "acceptExitOffer":
        this.handleAcceptExitOffer(id, msg.offerId);
        break;
      case "foundNewCompany":
        this.handleFoundNewCompany(id);
        break;
      case "takeLoan":
        this.handleTakeLoan(id, msg.amount);
        break;
      case "repayLoan":
        this.handleRepayLoan(id, msg.amount);
        break;
      case "rematch":
        this.handleRematch(id);
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
    let simBuyTotal = 0; // 투자자 매수 한도 검증용
    const simHoldings: Record<string, number> = { ...player.holdings };
    for (const o of cleaned) {
      const co = this.state.companies[o.companyOwnerId];
      const cost = o.shares * co.price; // +매수 +비용, -매도 -비용(=환매수익)
      cash -= cost;
      if (o.shares > 0) simBuyTotal += cost;
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
    // 투자자 매수 한도 초과 방어 (POSITION + 이미 소진분 합산).
    if (
      player.isInvestor &&
      player.roundStockBuyAmount + simBuyTotal >
        BALANCE.investorBuyQuotaPerRound
    ) {
      return;
    }

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
    // 투자자 매수 한도 체크 (매수만 카운트, 매도는 무제한).
    if (player.isInvestor && n > 0) {
      if (player.roundStockBuyAmount + cost > BALANCE.investorBuyQuotaPerRound) {
        return; // 이번 회차 매수 한도 초과
      }
    }

    player.cash = newCash;
    player.holdings[companyOwnerId] = after;
    // 이번 회차 매매 순현금 흐름 (매수 = 유출, 매도 = 유입). SETTLE 정산 보드에 공개.
    player.roundTradesCashFlow -= cost;
    if (n > 0) player.roundStockBuyAmount += cost;
    // 주가 임팩트: +매수면 ↑, -매도면 ↓.
    setPriceAndRecord(co, applyImpact(co.price, n, co.sharesOutstanding));
    this.broadcastSnapshot();
  }

  // SPEC 3.3 관리 페이즈: 기술 레벨 업그레이드. 회차당 1회, 최대 레벨 5.
  private handleTechUpgrade(id: string) {
    const ctx = getManageContext(this.state, id);
    if (!ctx) return;
    const { player, co } = ctx;
    if (co.techLevel >= 5) return;
    const cost = BALANCE.techUpgradeCost(co.techLevel);
    if (player.cash < cost) return;
    player.cash -= cost;
    co.techLevel += 1;
    this.state.log.push({
      round: this.state.round,
      text: `🔧 ${co.name} 기술 Lv.${co.techLevel} 업그레이드 (−${cost.toLocaleString()}원)`,
    });
    this.broadcastSnapshot();
  }

  // SPEC 3.6.5 관리 페이즈: 연구 투자.
  // tier 0/1/2 (100만/300만/500만). 확률에 따라 대성공/성공/실패.
  // 회차당 1회. 결과는 즉시 회사 주가에 적용.
  private handleResearch(id: string, tier: 0 | 1 | 2) {
    const ctx = getManageContext(this.state, id);
    if (!ctx) return;
    const { player, co } = ctx;
    if (co.researchDoneThisManage) return; // 이미 이번 회차 연구함
    const config = BALANCE.researchTiers[tier];
    if (!config) return;
    if (player.cash < config.cost) return;

    player.cash -= config.cost;
    co.researchDoneThisManage = true;

    const roll = Math.random();
    let outcome: "jackpot" | "success" | "fail";
    let boost = 0;
    if (roll < config.jackpot) {
      outcome = "jackpot";
      const [lo, hi] = BALANCE.researchJackpotRange;
      boost = lo + Math.random() * (hi - lo);
    } else if (roll < config.jackpot + config.success) {
      outcome = "success";
      const [lo, hi] = BALANCE.researchSuccessRange;
      boost = lo + Math.random() * (hi - lo);
    } else {
      outcome = "fail";
      boost = 0; // 4-2 A: 실패 시 손실 없음
    }
    co.lastResearchOutcome = outcome;

    if (boost > 0) {
      setPriceAndRecord(
        co,
        Math.max(1, Math.round(co.price * (1 + boost)))
      );
    }

    const emoji = outcome === "jackpot" ? "🎉" : outcome === "success" ? "🔬" : "💧";
    const label =
      outcome === "jackpot"
        ? `대성공 +${(boost * 100).toFixed(1)}%`
        : outcome === "success"
          ? `성공 +${(boost * 100).toFixed(1)}%`
          : `실패`;
    this.state.log.push({
      round: this.state.round,
      text: `${emoji} ${co.name} 연구 ${label} (투자 ${config.cost.toLocaleString()}원)`,
    });
    // 뉴스 이벤트: 모든 플레이어에게 팝업으로 표시
    this.pushNews(
      emoji,
      `${co.name} 연구 ${outcome === "jackpot" ? "대성공" : outcome === "success" ? "성공" : "실패"}`,
      outcome === "fail"
        ? `${player.nickname} 투자 ${config.cost.toLocaleString()}원 · 별 소득 없이 마무리`
        : `${player.nickname} 투자 ${config.cost.toLocaleString()}원 → 주가 +${(boost * 100).toFixed(1)}%`,
      outcome === "fail" ? "neutral" : "good"
    );
    this.broadcastSnapshot();
  }

  // SPEC 3.4 관리 페이즈: 사업 전환. 시장가액의 30% 비용, 신뢰도 3 리셋.
  private handlePivot(id: string, newSector: Sector) {
    const ctx = getManageContext(this.state, id);
    if (!ctx) return;
    const { player, co } = ctx;
    if (!SECTORS.includes(newSector)) return;
    if (co.sector === newSector) return; // 같은 섹터 불가
    const marketCap = co.price * co.sharesOutstanding;
    const cost = Math.floor(marketCap * BALANCE.pivotCostRate);
    if (player.cash < cost) return;
    player.cash -= cost;
    co.sector = newSector;
    co.trust = BALANCE.startingTrust;
    co.lieCount = 0;
    this.state.log.push({
      round: this.state.round,
      text: `🔀 ${co.name} 사업 전환 → ${newSector} (−${cost.toLocaleString()}원, 신뢰도 리셋)`,
    });
    this.broadcastSnapshot();
  }

  // === SPEC 3.5 엑시트 시스템 (재설계) ===

  // 국가 매각: 시장가의 50% 즉시 지급, 회사 소멸.
  private handleSellToNation(id: string) {
    const ctx = getManageContext(this.state, id);
    if (!ctx) return;
    const { player, co } = ctx;
    const marketCap = co.price * co.sharesOutstanding;
    const salePrice = Math.floor(marketCap * BALANCE.nationBuyoutRate);
    this.executeCompanyExit(player, co, salePrice, "NATION", "🏛️", "국가");
  }

  // 특정 NPC 인수 제안 수락: offerId 로 매칭.
  private handleAcceptExitOffer(id: string, offerId: number) {
    const ctx = getManageContext(this.state, id);
    if (!ctx) return;
    const { player, co } = ctx;
    const offer = this.state.exitOffers.find(
      (o) => o.id === offerId && o.companyOwnerId === id
    );
    if (!offer) return;
    this.executeCompanyExit(
      player,
      co,
      offer.price,
      offer.buyerKey,
      offer.buyerIcon,
      offer.buyerLabel
    );
  }

  // 공통 로직: 회사 매각 확정 처리. logic/exit.ts 로 위임.
  private executeCompanyExit(
    seller: PlayerState,
    co: NonNullable<GameState["companies"][string]>,
    salePrice: number,
    buyerKey: string,
    buyerIcon: string,
    buyerLabel: string
  ) {
    executeCompanyExit(
      this.state,
      this.pushNewsCallback(),
      seller,
      co,
      salePrice,
      buyerKey,
      buyerIcon,
      buyerLabel
    );
    this.broadcastSnapshot();
  }

  // logic 모듈에 주입하기 위한 pushNews 클로저. this 바인딩 문제 방지.
  private pushNewsCallback(): PushNewsFn {
    return (emoji, headline, detail, tone, extras) =>
      this.pushNews(emoji, headline, detail, tone, extras);
  }

  // 매 MANAGE 진입 시 회사별 확률적 인수 제안 생성 — logic/exit.ts 로 위임.
  private generateExitOffers() {
    generateExitOffers(this.state, this.pushNewsCallback());
  }

  // 신뢰도에 따른 대출 한도. 회사 없는 투자자는 대출 불가 (0 반환).
  // loanLimitFor / loanRateFor — logic/bank.ts 위임 래퍼.
  private loanLimitFor(player: PlayerState): number {
    return loanLimitFor(this.state, player);
  }
  private loanRateFor(player: PlayerState): number {
    return loanRateFor(this.state, player);
  }

  // 관리 페이즈: 대출 실행.
  private handleTakeLoan(id: string, amount: number) {
    const ctx = getManageContext(this.state, id);
    if (!ctx) return; // 회사 없는 투자자는 대출 불가
    const { player, co } = ctx;
    const req = Math.floor(Number(amount) || 0);
    if (req <= 0) return;
    const limit = this.loanLimitFor(player);
    if (player.loanBalance + req > limit) return; // 한도 초과
    player.cash += req;
    player.loanBalance += req;
    this.state.log.push({
      round: this.state.round,
      text: `🏦 ${co.name} 대출 실행 ${req.toLocaleString()}원 (잔액 ${player.loanBalance.toLocaleString()}원)`,
    });
    this.broadcastSnapshot();
  }

  // 관리 페이즈: 대출 상환.
  private handleRepayLoan(id: string, amount: number) {
    if (this.state.phase !== "MANAGE") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (player.loanBalance <= 0) return;
    let req = Math.floor(Number(amount) || 0);
    if (req <= 0) return;
    req = Math.min(req, player.loanBalance, player.cash);
    if (req <= 0) return;
    player.cash -= req;
    player.loanBalance -= req;
    // 상환 완료 → 미납 카운트 리셋(약속 지킴 신호).
    if (player.loanBalance === 0) player.loanMissCount = 0;
    const co = this.state.companies[id];
    this.state.log.push({
      round: this.state.round,
      text: `🏦 ${co ? co.name : player.nickname} 대출 상환 −${req.toLocaleString()}원 (잔액 ${player.loanBalance.toLocaleString()}원)`,
    });
    this.broadcastSnapshot();
  }

  // 부활 IPO: 투자자가 새 회사를 창업. 랜덤 섹터, 시장평균의 70% 시총으로 시작.
  private handleFoundNewCompany(id: string) {
    if (this.state.phase !== "MANAGE") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!player.isInvestor) return; // 이미 회사 있는 사람 불가
    if (this.state.companies[id]) return; // 방어
    const roundsLeft = this.state.maxRounds - this.state.round;
    if (roundsLeft < BALANCE.rebirthMinRoundsLeft) return;
    if (player.cash < BALANCE.rebirthCost) return;

    player.cash -= BALANCE.rebirthCost;
    player.isInvestor = false;

    // 시장 평균 시총 계산
    const others = Object.values(this.state.companies);
    const avgCap =
      others.length > 0
        ? others.reduce((s, c) => s + c.price * c.sharesOutstanding, 0) /
          others.length
        : BALANCE.startingPrice * SHARES_OUTSTANDING;
    const newCap = Math.floor(avgCap * BALANCE.rebirthCapMultiplier);
    const newPrice = Math.max(
      1,
      Math.floor(newCap / SHARES_OUTSTANDING)
    );
    const sectorList: Sector[] = [
      "IT_GAME",
      "BEAUTY",
      "CONSTRUCTION",
      "RETAIL",
      "BIO",
      "DEFENSE",
    ];
    const sector = sectorList[Math.floor(Math.random() * sectorList.length)];

    this.state.companies[id] = {
      ownerId: id,
      name: `${player.nickname} 사`,
      sector,
      price: newPrice,
      techLevel: BALANCE.startingTech,
      trust: BALANCE.startingTrust,
      sharesOutstanding: SHARES_OUTSTANDING,
      pricePoints: [newPrice],
      lieCount: 0,
      auditedThisRound: false,
      researchDoneThisManage: false,
      lastResearchOutcome: undefined,
    };

    this.state.log.push({
      round: this.state.round,
      text: `🌱 ${player.nickname} 부활 IPO · 새 회사 창업 (${sector})`,
    });
    this.pushNews(
      "🚀",
      `${player.nickname} 부활 IPO`,
      `투자자에서 창업자로 · 시장평균의 ${(BALANCE.rebirthCapMultiplier * 100).toFixed(0)}% 시총 스타트`,
      "good",
      {
        spotlight: true,
        flavorQuote: "포기하지 않는 자만이 시장에 남는다.",
        spotlightTone: "rebirth",
      }
    );
    this.broadcastSnapshot();
  }

  // SPEC 2장 ③: HYPE/WARN/SILENT 1장 선언 + 코멘트(선택) + 준비 처리.
  private handleDeclare(
    id: string,
    declaration: Declaration,
    comment?: string
  ) {
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
    // 코멘트 정리(trim + 60자 이내). 빈 문자열은 undefined 로.
    const clean = (comment ?? "").trim().slice(0, 60);
    player.declarationComment = clean.length > 0 ? clean : undefined;
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

    // LOBBY와 SETUP에서만 신규 합류 허용(SETUP은 새로고침 등으로 id 바뀐 경우 대비).
    if (this.state.phase !== "LOBBY" && this.state.phase !== "SETUP") return;
    if (this.state.players.length >= ROOM.maxPlayers) return;

    const player: PlayerState = {
      id,
      nickname: nickname.trim().slice(0, 16) || "player",
      cash: 0,
      holdings: {},
      ready: false,
      seedInvested: 0,
      purchasedInfos: [],
      isInvestor: false,
      roundTradesCashFlow: 0,
      loanBalance: 0,
      loanMissCount: 0,
      roundStockBuyAmount: 0,
      connected: true,
    };
    this.state.players.push(player);
    if (!this.state.hostId) this.state.hostId = id;

    this.broadcastSnapshot();
  }

  // SPEC 1.0.5: 호스트가 테스트용 봇 추가. LOBBY 단계, 정원 내에서만.
  private handleAddBot(id: string) {
    if (id !== this.state.hostId) return;
    if (this.state.phase !== "LOBBY") return;
    if (this.state.players.length >= ROOM.maxPlayers) return;
    const botNum = this.state.players.filter((p) => p.isBot).length + 1;
    const botId = `bot_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    this.state.players.push({
      id: botId,
      nickname: `봇 ${botNum}`,
      cash: 0,
      holdings: {},
      ready: false,
      seedInvested: 0,
      purchasedInfos: [],
      isInvestor: false,
      roundTradesCashFlow: 0,
      loanBalance: 0,
      loanMissCount: 0,
      roundStockBuyAmount: 0,
      isBot: true,
      connected: true,
    });
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
      pricePoints: [BALANCE.startingPrice],
      lieCount: 0,
      auditedThisRound: false,
      researchDoneThisManage: false,
      lastResearchOutcome: undefined,
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
    // MANAGE 종료 → 다음 회차 INFO 또는 게임 종료.
    if (this.state.phase === "MANAGE") {
      // 남아있는 인수 제안은 자동 소멸 (다음 MANAGE에 새로 생성됨)
      this.state.exitOffers = [];
      if (this.state.round < this.state.maxRounds) {
        this.state.round += 1;
        this.resetRoundScopedFields();
        this.enterPhase("INFO");
      } else {
        this.endGame();
      }
      return;
    }

    const idx = ROUND_PHASES.indexOf(this.state.phase);
    if (idx === -1) return;

    if (idx < ROUND_PHASES.length - 1) {
      this.enterPhase(ROUND_PHASES[idx + 1]);
      return;
    }

    // SETTLE 종료 → 마지막 회차면 바로 종료, 아니면 MANAGE.
    if (this.state.round >= this.state.maxRounds) {
      this.endGame();
    } else {
      this.enterPhase("MANAGE");
    }
  }

  private enterPhase(phase: Phase) {
    this.clearTradeTimer();
    this.state.phase = phase;
    for (const p of this.state.players) p.ready = false;

    if (phase === "INFO") this.onEnterInfo();
    if (phase === "TRADE") this.onEnterTrade();
    if (phase === "SETTLE") this.onEnterSettle();

    // SPEC 1.0.5 봇 자동 행동 스케줄.
    this.scheduleBotActions(phase);

    if (phase === "TRADE") {
      const ms = BALANCE.tradeWindowSec * 1000;
      this.state.phaseDeadline = Date.now() + ms;
      this.tradeTimer = setTimeout(() => this.onTradeTimeout(), ms);
      // 시장 마이크로 노이즈 시작 (1B: 상시 잔파도)
      this.startMarketNoise();
    } else if (phase === "MANAGE") {
      // SPEC 3.3~3.5: 30초 관리 페이즈 타이머. 종료 시 자동 다음 회차/게임 종료.
      const ms = BALANCE.manageWindowSec * 1000;
      this.state.phaseDeadline = Date.now() + ms;
      this.tradeTimer = setTimeout(() => this.onManageTimeout(), ms);
      // 새 페이즈 시작 시 인수 제안 재생성 + 연구 리셋
      this.generateExitOffers();
      for (const co of Object.values(this.state.companies)) {
        co.researchDoneThisManage = false;
        co.lastResearchOutcome = undefined;
      }
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
      p.declaration = undefined;
      p.purchasedInfos = [];
      p.investorInsiderInfo = undefined;
      // 이번 회차 매매 순손익 카운터 리셋 (SETTLE 보드에서 공개될 유일한 재무 지표).
      p.roundTradesCashFlow = 0;
      // 투자자 매수 한도 카운터 리셋.
      p.roundStockBuyAmount = 0;

      if (p.isInvestor || !this.state.companies[p.id]) {
        // 투자자: 자기 회사 없음 → privateInfo 없음.
        // 대신 랜덤 회사의 방향을 인사이더 정보로 무료 지급 (SPEC 3.5 특권).
        p.privateInfo = undefined;
        const targets = Object.values(this.state.companies);
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          p.investorInsiderInfo = {
            ownerId: t.ownerId,
            direction: Math.random() < 0.5 ? "BULLISH" : "BEARISH",
          };
        }
      } else {
        p.privateInfo = Math.random() < 0.5 ? "BULLISH" : "BEARISH";
      }
    }
    // 회차 시작 — 가격 히스토리 새 회차분으로 초기화(현 가격 한 점부터 시작).
    for (const co of Object.values(this.state.companies)) {
      co.pricePoints = [co.price];
    }
    this.rollGlobalEvent();
    // 5/7회차 특별 이벤트 결정 + 예고 스포트라이트.
    rollSpecialEventsOnInfo(this.state, this.pushNewsCallback(), SECTOR_LABELS);
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
    // 시장 뉴스 팝업
    this.pushNews(
      "🌐",
      this.state.pendingGlobalEvent.headline,
      `${(signedMag * 100).toFixed(1)}% · 이번 회차 정산 반영 예정`,
      signedMag > 0 ? "good" : "bad"
    );
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
        p.roundTradesCashFlow -= cost;
        if (o.shares > 0) p.roundStockBuyAmount += cost;
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
      setPriceAndRecord(co, applyImpact(co.price, net, co.sharesOutstanding));
    }
  }

  // SPEC 2장 ⑤ + 1.1 + 3.6 + 3.7: 글로벌 이벤트 + 개인 이벤트 + 성장 보너스 +
  // 신뢰도 ±1 + 세무 조사 + 연구 잭팟. 매매는 TRADE 에서 이미 끝남.
  private onEnterSettle() {
    // 0) 정산 전 스냅샷 (SETTLE 화면 비교용)
    for (const co of Object.values(this.state.companies)) {
      co.prevSettlePrice = co.price;
      co.prevSettleTrust = co.trust;
    }
    // 1) 이벤트: 블랙스완(7회차) 있으면 그것만, 없으면 일반 글로벌 이벤트.
    const startPrices: Record<string, number> = {};
    for (const co of Object.values(this.state.companies)) {
      startPrices[co.ownerId] = co.price;
    }
    const bigEventApplied = applyBigEventOnSettle(
      this.state,
      this.pushNewsCallback(),
      SECTOR_LABELS
    );
    if (!bigEventApplied) {
      // 기존 GlobalEvent 처리 (섹터 지정 이벤트).
      const ge = this.state.pendingGlobalEvent;
      if (ge) {
        for (const co of Object.values(this.state.companies)) {
          if (co.sector === ge.sector) {
            setPriceAndRecord(
              co,
              Math.max(1, Math.round(co.price * (1 + ge.magnitude)))
            );
          }
        }
        this.state.log.push({
          round: this.state.round,
          text: `🌐 ${ge.headline} ${(ge.magnitude * 100).toFixed(1)}%`,
        });
      }
    }

    // 2) 개인 이벤트 + 신뢰도 + 감사 + 연구 (회사별 루프)
    for (const p of this.state.players) {
      const co = this.state.companies[p.id];
      if (!co) continue;
      co.auditedThisRound = false; // 매 정산마다 초기화

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

      // 기술 레벨 보너스 (SPEC 3.3): techLevel × techGrowthPerLevel.
      const techBonus = co.techLevel * BALANCE.techGrowthPerLevel;

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
      co.trust = clampTrust(co.trust + trustDelta);

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

      // 연구 잭팟은 이제 정산 자동 아님. 관리 페이즈에서 능동 발동됨(handleResearch).
      // 여기서는 아무 delta 도 추가하지 않는다.
      const researchDelta = 0;

      const prevPrice = co.price;
      // 합성 변동: 이벤트 + 성장보너스 + 기술 + 세무 조사 + 연구 성공. 한 번에 곱.
      setPriceAndRecord(
        co,
        Math.max(
          1,
          Math.round(
            prevPrice *
              (1 + eventDelta + seedBonus + techBonus + auditDelta + researchDelta)
          )
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
        this.pushNews(
          "🚨",
          `${co.name} 세무 조사`,
          `거짓 선언 누적 · 주가 ${(auditDelta * 100).toFixed(1)}%`,
          "bad"
        );
      }
      // (연구 결과 로그는 handleResearch 발동 시점에 이미 기록됨)
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

    // 3.5) 5회차 레버리지 배수 적용 — 회사별 최종 변동률에 배수 곱함.
    applyLeverageOnSettle(this.state, this.pushNewsCallback());

    // 4) 은행 시스템 — 이자 부과, 미납 처리, 압류 판정.
    this.processBankingSettle();

    // 5) 글로벌 이벤트 소비
    this.state.pendingGlobalEvent = undefined;
  }

  // SETTLE 정산 은행 단계 — logic/bank.ts 로 위임.
  private processBankingSettle() {
    processBankingSettle(this.state, this.pushNewsCallback());
  }

  private onTradeTimeout() {
    if (this.state.phase !== "TRADE") return;
    this.advancePhase();
  }

  private onManageTimeout() {
    if (this.state.phase !== "MANAGE") return;
    this.advancePhase();
  }

  private endGame() {
    this.clearTradeTimer();
    this.state.phase = "ENDED";
    this.state.phaseDeadline = undefined;
    this.state.finalRankings = this.computeFinalRankings();
    this.state.log.push({ round: this.state.round, text: "게임 종료" });
    this.broadcastSnapshot();
  }

  // 총자산 랭킹 — logic/rankings.ts 위임 래퍼.
  private computeFinalRankings() {
    return computeFinalRankings(this.state);
  }

  // 리매치: 호스트만, ENDED 상태에서 같은 인원으로 로비 복귀. (SPEC 6장 M7)
  private handleRematch(id: string) {
    if (id !== this.state.hostId) return;
    if (this.state.phase !== "ENDED") return;
    for (const p of this.state.players) {
      p.cash = 0;
      p.holdings = {};
      p.ready = false;
      p.declaration = undefined;
      p.privateInfo = undefined;
      p.pendingPosition = undefined;
      p.seedInvested = 0;
      p.purchasedInfos = [];
      p.isInvestor = false;
      p.investorInsiderInfo = undefined;
      p.roundTradesCashFlow = 0;
      p.loanBalance = 0;
      p.loanMissCount = 0;
      p.roundStockBuyAmount = 0;
    }
    this.state.companies = {};
    this.state.exitOffers = [];
    this.state.newsEvents = [];
    this.state.round = 0;
    this.state.phase = "LOBBY";
    this.state.phaseDeadline = undefined;
    this.state.pendingGlobalEvent = undefined;
    this.state.pendingLeverage = undefined;
    this.state.pendingBigEvent = undefined;
    this.state.lastHotSector = undefined;
    this.state.finalRankings = undefined;
    this.state.log = [{ round: 0, text: "리매치 준비" }];
    this.broadcastSnapshot();
  }

  // SPEC 1.0.5: 봇들의 자동 행동. 각 페이즈 진입 시 setTimeout 으로 약간의 지연 후 실행.
  // 페이즈가 이미 바뀌었으면 무시한다.
  private scheduleBotActions(phase: Phase) {
    const bots = () =>
      this.state.players.filter((p) => p.isBot && p.connected);
    if (bots().length === 0) return;

    const sectorList: Sector[] = [
      "IT_GAME",
      "BEAUTY",
      "CONSTRUCTION",
      "RETAIL",
      "BIO",
      "DEFENSE",
    ];
    const declarations: Declaration[] = ["HYPE", "WARN", "SILENT"];

    if (phase === "SETUP") {
      setTimeout(() => {
        if (this.state.phase !== "SETUP") return;
        for (const bot of bots()) {
          if (this.state.companies[bot.id]) continue;
          const s = sectorList[Math.floor(Math.random() * sectorList.length)];
          this.handleSetup(bot.id, s, `${bot.nickname} 사`, 0);
        }
      }, 1200);
    } else if (phase === "INFO" || phase === "SETTLE") {
      setTimeout(() => {
        if (this.state.phase !== phase) return;
        for (const bot of bots()) {
          if (!bot.ready) this.handleReady(bot.id);
        }
      }, 1500);
    } else if (phase === "POSITION") {
      setTimeout(() => {
        if (this.state.phase !== "POSITION") return;
        for (const bot of bots()) {
          if (bot.ready) continue;
          // 봇은 빈 포지션으로 관망 (단순/안전).
          this.handleSubmitPosition(bot.id, []);
        }
      }, 1800);
    } else if (phase === "DECLARE") {
      setTimeout(() => {
        if (this.state.phase !== "DECLARE") return;
        for (const bot of bots()) {
          if (bot.ready) continue;
          // 투자자 봇은 선언 불가 → 그냥 ready
          if (bot.isInvestor || !this.state.companies[bot.id]) {
            this.handleReady(bot.id);
            continue;
          }
          const d =
            declarations[Math.floor(Math.random() * declarations.length)];
          this.handleDeclare(bot.id, d);
        }
      }, 1500);
    } else if (phase === "MANAGE") {
      // 봇: 기술 업그레이드/연구/엑시트 결정.
      setTimeout(() => {
        if (this.state.phase !== "MANAGE") return;
        const roundsLeft = this.state.maxRounds - this.state.round;
        for (const bot of bots()) {
          const co = this.state.companies[bot.id];
          // 회사 없으면 (투자자) → 부활 IPO 가끔 시도
          if (!co) {
            if (
              roundsLeft >= BALANCE.rebirthMinRoundsLeft &&
              bot.cash >= BALANCE.rebirthCost &&
              Math.random() < 0.2
            ) {
              this.handleFoundNewCompany(bot.id);
            }
            continue;
          }
          // 엑시트 결정: 남은 회차에 따라 수락 확률 변함
          const myOffers = this.state.exitOffers.filter(
            (o) => o.companyOwnerId === bot.id
          );
          if (myOffers.length > 0) {
            const best = myOffers.reduce((a, b) =>
              a.price > b.price ? a : b
            );
            // 종반 + 좋은 제안이면 수락 확률 높음
            const acceptChance =
              (roundsLeft <= 2 ? 0.5 : 0.15) + (best.priceRate - 0.5) * 0.5;
            if (Math.random() < acceptChance) {
              this.handleAcceptExitOffer(bot.id, best.id);
              continue; // 매각했으면 더 행동 안 함
            }
          }
          if (Math.random() < 0.3 && co.techLevel < 5) {
            const cost = BALANCE.techUpgradeCost(co.techLevel);
            if (bot.cash >= cost) this.handleTechUpgrade(bot.id);
          }
          if (Math.random() < 0.25 && !co.researchDoneThisManage) {
            const tier = Math.floor(Math.random() * 3) as 0 | 1 | 2;
            if (bot.cash >= BALANCE.researchTiers[tier].cost) {
              this.handleResearch(bot.id, tier);
            }
          }
        }
      }, 2500);
    } else if (phase === "TRADE") {
      // 거래 페이즈 동안 봇이 산발적으로 매매. 5번 시도.
      const ms = BALANCE.tradeWindowSec * 1000;
      for (let i = 0; i < 5; i++) {
        const delay = 2500 + (i * ms) / 6;
        setTimeout(() => {
          if (this.state.phase !== "TRADE") return;
          for (const bot of bots()) {
            // 회차당 40% 확률로만 행동.
            if (Math.random() > 0.4) continue;
            const otherCids = Object.keys(this.state.companies).filter(
              (cid) => cid !== bot.id
            );
            if (otherCids.length === 0) continue;
            const target =
              otherCids[Math.floor(Math.random() * otherCids.length)];
            const held = bot.holdings[target] ?? 0;
            // 보유 없으면 매수, 있으면 50% 확률로 매도/매수.
            const buy = held === 0 || Math.random() < 0.6;
            const shares = buy ? BALANCE.liveTradeStep : -BALANCE.liveTradeStep;
            this.handleTrade(bot.id, target, shares);
          }
        }, delay);
      }
    }
  }

  private resetRoundScopedFields() {
    for (const p of this.state.players) {
      p.declaration = undefined;
      p.declarationComment = undefined;
      p.privateInfo = undefined;
      p.pendingPosition = undefined;
      p.purchasedInfos = [];
    }
  }

  // 뉴스 이벤트 push (모든 플레이어 스냅샷에 포함되어 팝업으로 렌더).
  private pushNews(
    emoji: string,
    headline: string,
    detail: string | undefined,
    tone: "good" | "bad" | "neutral",
    extras?: {
      spotlight?: boolean;
      flavorQuote?: string;
      spotlightTone?: "celebration" | "hostile" | "somber" | "rebirth";
    }
  ) {
    this.state.newsEvents.push({
      id: nextNewsId++,
      timestamp: Date.now(),
      emoji,
      headline,
      detail,
      tone,
      round: this.state.round,
      spotlight: extras?.spotlight,
      flavorQuote: extras?.flavorQuote,
      spotlightTone: extras?.spotlightTone,
    });
    if (this.state.newsEvents.length > NEWS_LIMIT) {
      this.state.newsEvents.splice(
        0,
        this.state.newsEvents.length - NEWS_LIMIT
      );
    }
  }

  private clearTradeTimer() {
    if (this.tradeTimer) {
      clearTimeout(this.tradeTimer);
      this.tradeTimer = undefined;
    }
    this.stopMarketNoise();
  }

  // 시장 마이크로 노이즈: 거래 페이즈 동안 매 tradeNoiseIntervalMs 마다
  // 각 회사에 ±tradeNoiseMagnitude 미만의 랜덤 흔들림 추가. 평균 0.
  private startMarketNoise() {
    this.stopMarketNoise();
    this.noiseTimer = setInterval(() => {
      if (this.state.phase !== "TRADE") return;
      let anyChange = false;
      for (const co of Object.values(this.state.companies)) {
        // 평균 0, 대략 -mag~+mag 균등분포
        const delta =
          (Math.random() * 2 - 1) * BALANCE.tradeNoiseMagnitude;
        const newPrice = Math.max(1, Math.round(co.price * (1 + delta)));
        if (newPrice !== co.price) {
          setPriceAndRecord(co, newPrice);
          anyChange = true;
        }
      }
      if (anyChange) this.broadcastSnapshot();
    }, BALANCE.tradeNoiseIntervalMs);
  }

  private stopMarketNoise() {
    if (this.noiseTimer) {
      clearInterval(this.noiseTimer);
      this.noiseTimer = undefined;
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
              investorInsiderInfo: undefined,
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
