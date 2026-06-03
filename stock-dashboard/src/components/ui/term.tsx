"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

// 초보자용 용어 사전
export const GLOSSARY: Record<string, string> = {
  RSI: "최근 14일간 '오른 힘 vs 내린 힘'을 0~100으로 나타낸 지표. 70 이상이면 과열(과매수), 30 이하면 침체(과매도)로 봐요.",
  PER: "주가가 회사 '1년 순이익'의 몇 배인지(주가÷주당순이익). 낮으면 이익 대비 저렴, 높으면 미래 성장 기대가 큰 편이에요. 업종·과거와 비교해서 봐요.",
  PBR: "주가가 회사 '순자산(자본)'의 몇 배인지. 1배 미만이면 장부가치보다 싸게 거래된다는 의미예요.",
  EPS: "주당순이익. 회사가 1년에 번 순이익을 주식 수로 나눈 값으로, 한 주가 벌어들인 이익이에요.",
  BPS: "주당순자산. 회사 순자산을 주식 수로 나눈 값으로, 한 주에 담긴 자본의 크기예요.",
  ROE: "자기자본이익률. 회사가 가진 자본으로 얼마나 이익을 냈는지(%). 높을수록 돈을 효율적으로 버는 회사예요.",
  순이익률: "매출에서 최종 이익이 차지하는 비율(%). 높을수록 남는 장사를 한다는 뜻이에요.",
  "부채비율": "회사가 자본 대비 빚을 얼마나 졌는지(D/E). 너무 높으면 재무 부담이 큰 편이에요.",
  배당수익률: "현재 주가 대비 1년에 받는 배당금 비율(%). 예금 이자처럼 주식 보유로 받는 현금 수익이에요.",
  거래량: "일정 기간 사고팔린 주식 수. 거래량이 갑자기 늘면 큰 뉴스·관심이 몰린 경우가 많아요.",
  시가총액: "주가 × 총 주식 수 = 회사의 시장 가치. 클수록 '대형주', 많은 사람이 거래·보유하는 경향이 있어요.",
  EMA: "지수이동평균. 최근 가격에 더 큰 비중을 둔 평균선으로, 추세 방향을 볼 때 써요. (예: 20일선이 60일선 위면 상승 추세)",
  MACD: "단기·장기 이동평균의 차이로 추세의 강도와 전환을 보는 지표예요.",
  VIX: "미국 시장의 '공포지수'. 높을수록 투자자 불안·변동성이 크고, 낮을수록 시장이 안정적이에요.",
  베타: "시장이 1% 움직일 때 이 종목이 평균 몇 % 움직이는지. 1보다 크면 시장보다 더 출렁이는 종목이에요.",
};

interface TermProps {
  /** 표시할 라벨(기본은 term과 동일) */
  label?: string;
  /** 용어 키(GLOSSARY) */
  term: string;
}

export function Term({ label, term }: TermProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const desc = GLOSSARY[term];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center gap-0.5">
      {label ?? term}
      {desc ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label={`${term} 설명`}
          className="text-zinc-400 transition-colors hover:text-violet-500"
        >
          <HelpCircle className="h-3 w-3" />
        </button>
      ) : null}
      {open && desc ? (
        <span className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-2.5 text-[11px] font-normal leading-relaxed text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <span className="mb-0.5 block font-semibold text-violet-500">{term}</span>
          {desc}
        </span>
      ) : null}
    </span>
  );
}
