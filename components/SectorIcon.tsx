/* eslint-disable @next/next/no-img-element */
import type { Sector } from "@/game/types";

// 섹터 픽셀아트 아이콘 (public/sectors/*.png).
// 픽셀아트가 뭉개지지 않도록 image-rendering: pixelated.
// 사이즈는 px 단위. 기본 32.
const FILE: Record<Sector, string> = {
  IT_GAME: "/sectors/it_game.png",
  BEAUTY: "/sectors/beauty.png",
  CONSTRUCTION: "/sectors/construction.png",
  RETAIL: "/sectors/retail.png",
  BIO: "/sectors/bio.png",
  DEFENSE: "/sectors/defense.png",
};

export default function SectorIcon({
  sector,
  size = 32,
  className,
}: {
  sector: Sector;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={FILE[sector]}
      alt={sector}
      width={size}
      height={size}
      className={className}
      style={{
        imageRendering: "pixelated",
        display: "inline-block",
        verticalAlign: "middle",
      }}
    />
  );
}
