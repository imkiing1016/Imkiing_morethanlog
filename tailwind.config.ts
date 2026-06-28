import type { Config } from "tailwindcss";

// 디자인 토큰은 SPEC.md 5장을 단일 진실 원천으로 한다.
// 색은 의미를 인코딩: 호재=초록(success), 악재=빨강(danger), 중립=회색.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 캐주얼 동물 컨셉 팔레트 — 따뜻한 크림 + 부드러운 의미색.
        // 의미색은 SPEC 5장 그대로(호재/악재/중립). 톤만 부드럽게.
        danger: "#e07a7a", // INFO / POSITION (비공개) · 악재
        warning: "#f0b740", // DECLARE (공개 선언) · 노란 강조
        success: "#5ec06b", // TRADE (거래) · 호재
        info: "#6fa9d6", // SETTLE (정산) · 푸른 차분함
        neutral: "#8c8275", // 중립 (따뜻한 회색)
        ink: "#3a322a", // 본문 텍스트 (따뜻한 흑갈)
        paper: "#fdf6e9", // 배경 크림
        card: "#ffffff", // 카드 흰 종이
        cardEdge: "#e8dcc1", // 카드 테두리 (오트밀)
        accentSoft: "#fff3cf", // 강조 옅음
      },
      borderRadius: {
        // SPEC 5장: 카드 12px, 요소 8px
        card: "12px",
        element: "8px",
      },
      fontWeight: {
        // SPEC 5장: 400/500 두 가지만
        normal: "400",
        medium: "500",
      },
    },
  },
  plugins: [],
};

export default config;
