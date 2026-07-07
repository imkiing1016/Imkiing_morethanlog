import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인생여전 & 역전",
  description: "내가 아는 미래 정보를 진실 혹은 뻥카로 흘리는 멀티플레이어 주식게임",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
