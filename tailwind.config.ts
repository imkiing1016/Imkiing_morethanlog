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
        // 페이즈별 액센트 (SPEC 5장)
        danger: "#e5484d", // INFO / POSITION (비공개)
        warning: "#e3b341", // DECLARE (공개 선언)
        success: "#30a46c", // TRADE (거래/시간제한)
        info: "#3b82f6", // SETTLE (정산)
        neutral: "#8b8d98", // 중립
        ink: "#1c1c1f",
        paper: "#fbfbfc",
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
