// 단순 스파크라인 SVG (렌더 전용, 게임 계산 없음).
// 마지막 점을 강조 + 시작 점 대비 양/음에 따라 색.
export default function Sparkline({
  points,
  width = 80,
  height = 28,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!points || points.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="2"
        />
      </svg>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const rng = max - min || 1;
  const stepX = width / (points.length - 1);
  const pad = 3;
  const usable = height - pad * 2;
  const xy = points.map((v, i) => [
    +(i * stepX).toFixed(2),
    +(pad + (1 - (v - min) / rng) * usable).toFixed(2),
  ]);
  const poly = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  const isUp = points[points.length - 1] >= points[0];
  const stroke = isUp ? "#5ec06b" : "#e07a7a";
  const fill = isUp ? "#5ec06b22" : "#e07a7a22";
  const area = `${0},${height} ${poly} ${width},${height}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <polygon points={area} fill={fill} />
      <polyline
        points={poly}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r={2.5} fill={stroke} />
    </svg>
  );
}
