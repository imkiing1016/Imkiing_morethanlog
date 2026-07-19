// 특별 이벤트: 5회차 레버리지 / 7회차 블랙스완.
// INFO 진입 시 결정 → 예고 스포트라이트 → SETTLE 에서 적용.
import { BALANCE } from "../balance";
import { SECTORS } from "../types";
import type { GameState, PendingBigEvent, Sector } from "../types";
import type { PushNewsFn } from "./exit";
import { setPriceAndRecord } from "./pricing";
import { clampTrust } from "../helpers";

// 가중치 룰렛으로 레버리지 배수 선택.
function pickLeverageMultiplier(): number {
  const choices = BALANCE.leverageMultipliers;
  const total = choices.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of choices) {
    r -= c.weight;
    if (r <= 0) return c.multiplier;
  }
  return choices[0].multiplier;
}

// 블랙스완 이벤트 하나 랜덤 뽑기 + 파라미터 결정.
function rollBigEvent(state: GameState): PendingBigEvent {
  const types = BALANCE.bigEvents;
  const pick = types[Math.floor(Math.random() * types.length)];
  const evt: PendingBigEvent = {
    key: pick.key,
    label: pick.label,
    emoji: pick.emoji,
    quote: pick.quote,
    kind: pick.kind,
  };
  if (pick.kind === "global") {
    const [lo, hi] = pick.magnitudeRange;
    evt.magnitude = lo + Math.random() * (hi - lo);
    evt.trustDelta = pick.trustDelta;
  } else if (pick.kind === "sectorCrash" || pick.kind === "sectorBoom") {
    evt.targetSector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
    const [tLo, tHi] = pick.targetRange;
    const [oLo, oHi] = pick.otherRange;
    evt.targetMagnitude = tLo + Math.random() * (tHi - tLo);
    evt.otherMagnitude = oLo + Math.random() * (oHi - oLo);
  } else if (pick.kind === "chaos") {
    const [lo, hi] = pick.perCompanyRange;
    const perCo: Record<string, number> = {};
    for (const co of Object.values(state.companies)) {
      perCo[co.ownerId] = lo + Math.random() * (hi - lo);
    }
    evt.perCompany = perCo;
  }
  return evt;
}

// 섹터 라벨 삽입해 대사 완성.
function formatQuote(evt: PendingBigEvent, sectorLabels: Record<Sector, string>): string {
  if (evt.targetSector) {
    return evt.quote.replace(/○○/g, sectorLabels[evt.targetSector]);
  }
  return evt.quote;
}

// INFO 진입 시 호출 — 회차에 맞으면 이벤트 결정 + 예고 스포트라이트 뉴스.
// SECTOR_LABELS 를 여기서 import 하면 순환 참조 위험 있어 콜러가 전달.
export function rollSpecialEventsOnInfo(
  state: GameState,
  pushNews: PushNewsFn,
  sectorLabels: Record<Sector, string>
): void {
  if (state.round === BALANCE.leverageEventRound) {
    const m = pickLeverageMultiplier();
    state.pendingLeverage = m;
    pushNews(
      "🎢",
      `⚡ 레버리지 데이 · ${m}배`,
      `이번 회차 최종 주가 변동률이 ${m}배로 증폭됩니다. 상승도 하락도 몇 배.`,
      "neutral",
      {
        spotlight: true,
        flavorQuote: "월가의 광기가 시장을 지배한다. 오늘의 모든 결정은 " +
          m + "배!",
        spotlightTone: "hostile",
      }
    );
  }
  if (state.round === BALANCE.bigEventRound) {
    const evt = rollBigEvent(state);
    state.pendingBigEvent = evt;
    let detail = "";
    if (evt.kind === "global") {
      detail = `전 회사 주가 ${(evt.magnitude! * 100).toFixed(0)}% · 신뢰 ${evt.trustDelta! >= 0 ? "+" : ""}${evt.trustDelta}`;
    } else if (evt.kind === "sectorCrash") {
      detail = `${sectorLabels[evt.targetSector!]} ${(evt.targetMagnitude! * 100).toFixed(0)}% · 나머지 ${(evt.otherMagnitude! * 100).toFixed(0)}%`;
    } else if (evt.kind === "sectorBoom") {
      detail = `${sectorLabels[evt.targetSector!]} +${(evt.targetMagnitude! * 100).toFixed(0)}% · 나머지 ${(evt.otherMagnitude! * 100).toFixed(0)}%`;
    } else if (evt.kind === "chaos") {
      detail = "회사별 개별 운명. 예측 불가.";
    }
    const cfg = BALANCE.bigEvents.find((b) => b.key === evt.key);
    pushNews(
      evt.emoji,
      `🌩️ ${evt.label}`,
      detail,
      cfg?.tone ?? "neutral",
      {
        spotlight: true,
        flavorQuote: formatQuote(evt, sectorLabels),
        spotlightTone:
          evt.kind === "sectorBoom" || evt.key === "CRYPTO"
            ? "celebration"
            : evt.kind === "chaos"
              ? "somber"
              : "hostile",
      }
    );
  }
}

// SETTLE 에서 블랙스완 적용 (기존 pendingGlobalEvent 대신 처리).
// 반환값 true 이면 기존 GlobalEvent 처리를 스킵.
export function applyBigEventOnSettle(
  state: GameState,
  pushNews: PushNewsFn,
  sectorLabels: Record<Sector, string>
): boolean {
  const evt = state.pendingBigEvent;
  if (!evt) return false;
  const cos = Object.values(state.companies);
  if (evt.kind === "global") {
    for (const co of cos) {
      setPriceAndRecord(
        co,
        Math.max(1, Math.round(co.price * (1 + (evt.magnitude ?? 0))))
      );
      if (evt.trustDelta) co.trust = clampTrust(co.trust + evt.trustDelta);
    }
  } else if (evt.kind === "sectorCrash" || evt.kind === "sectorBoom") {
    for (const co of cos) {
      const isTarget = co.sector === evt.targetSector;
      const m = isTarget ? evt.targetMagnitude! : evt.otherMagnitude!;
      setPriceAndRecord(co, Math.max(1, Math.round(co.price * (1 + m))));
    }
  } else if (evt.kind === "chaos") {
    for (const co of cos) {
      const m = evt.perCompany?.[co.ownerId] ?? 0;
      setPriceAndRecord(co, Math.max(1, Math.round(co.price * (1 + m))));
    }
  }
  state.log.push({
    round: state.round,
    text: `${evt.emoji} ${evt.label} — ${formatQuote(evt, sectorLabels)}`,
  });
  pushNews(
    evt.emoji,
    `🌩️ ${evt.label} 발동`,
    `${formatQuote(evt, sectorLabels)}`,
    evt.kind === "sectorBoom" || evt.key === "CRYPTO" ? "good" : "bad",
    {
      spotlight: true,
      flavorQuote: `"${formatQuote(evt, sectorLabels)}"`,
      spotlightTone:
        evt.kind === "sectorBoom" || evt.key === "CRYPTO"
          ? "celebration"
          : evt.kind === "chaos"
            ? "somber"
            : "hostile",
    }
  );
  state.pendingBigEvent = undefined;
  return true;
}

// SETTLE 처리 완료 후 (모든 delta 반영된 후) 회사별 최종 변동률에 레버리지 배수 적용.
// prevSettlePrice 는 SETTLE 시작 시점에 스냅샷된 값 (onEnterSettle 첫 부분).
export function applyLeverageOnSettle(
  state: GameState,
  pushNews: PushNewsFn
): void {
  const m = state.pendingLeverage;
  if (!m) return;
  for (const co of Object.values(state.companies)) {
    const prev = co.prevSettlePrice ?? co.price;
    if (prev <= 0) continue;
    const pct = (co.price - prev) / prev;
    const boosted = pct * m;
    setPriceAndRecord(co, Math.max(1, Math.round(prev * (1 + boosted))));
  }
  state.log.push({
    round: state.round,
    text: `🎢 레버리지 데이 · 이번 회차 주가 변동률 ${m}배 증폭 적용`,
  });
  pushNews(
    "🎢",
    `⚡ 레버리지 ${m}배 적용 완료`,
    "이번 회차 최종 변동률이 " + m + "배로 확정되었습니다.",
    "neutral",
    { spotlight: false }
  );
  state.pendingLeverage = undefined;
}
