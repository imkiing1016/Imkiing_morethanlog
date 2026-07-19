// 엑시트 인수자별 연출 데이터.
// - BUYER_QUOTES: 매각 성사 순간 SpotlightModal 에 표시할 flavor 대사 (3종)
// - pickQuote: 랜덤 선택
// - buyerSpotlightTone: 오버레이 색 톤 (celebration/hostile/somber/rebirth)
//
// 왜 balance.ts 가 아니라 여기: balance 는 수치, 이건 연출용 텍스트.
import type { SpotlightTone } from "../types";

export const BUYER_QUOTES: Record<string, string[]> = {
  NATION: [
    "국가가 인수합니다. 상장폐지 절차 진행.",
    "공공의 이익을 위해 접수했습니다.",
    "국유화 완료. 시장에서 지웁니다.",
  ],
  HAWK: [
    "네 회사, 뜯어서 팔면 딱이야.",
    "월스트리트에서 왔다. 정리하지.",
    "숫자만 봐도 답이 나오네. 인수.",
  ],
  HEDGE: [
    "네 섹터 자체를 갈아엎어 주지.",
    "약점 다 보인다. 헤지펀드가 접수한다.",
    "이 판은 이제 우리 판이야.",
  ],
  CHAEBOL: [
    "아버지가 사드리라 하셨어.",
    "그룹 포트폴리오에 얹지.",
    "그래, 얼마면 되겠어?",
  ],
  VC: [
    "당신의 비전에 투자합니다!",
    "이거… 유니콘 될 각인데?",
    "다음 라운드까지 우리가 챙깁니다.",
  ],
  MYSTERY: [
    "…(익명의 매수자로부터 도착한 서류)",
    "누가 산 건지는 아무도 모른다.",
    "프리미엄에 접수. 질문은 사절.",
  ],
  BANK: [
    "채무불이행. 담보권을 집행합니다.",
    "안타깝지만 자산은 은행 소유입니다.",
    "약속을 지키지 못한 대가입니다.",
  ],
};

export function pickQuote(buyerKey: string): string {
  const list = BUYER_QUOTES[buyerKey] ?? BUYER_QUOTES.MYSTERY;
  return list[Math.floor(Math.random() * list.length)];
}

// VC/CHAEBOL/MYSTERY 는 축제, HAWK/HEDGE/BANK 는 위협적, NATION 은 담담.
export function buyerSpotlightTone(buyerKey: string): SpotlightTone {
  if (buyerKey === "HAWK" || buyerKey === "HEDGE" || buyerKey === "BANK")
    return "hostile";
  if (buyerKey === "NATION") return "somber";
  return "celebration";
}
