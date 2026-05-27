"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Candle } from "@/types/stock";

interface Series {
  ticker: string;
  name: string;
  candles: Candle[];
  color: string;
}

interface CompareChartProps {
  series: Series[];
}

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

export function CompareChart({ series }: CompareChartProps) {
  const data = useMemo(() => {
    const timeMap = new Map<number, Record<string, number>>();
    series.forEach((s) => {
      if (s.candles.length === 0) return;
      const base = s.candles[0].close;
      s.candles.forEach((c) => {
        const day = Math.floor(c.time / 86400) * 86400;
        if (!timeMap.has(day)) timeMap.set(day, { time: day });
        const ret = ((c.close - base) / base) * 100;
        timeMap.get(day)![s.ticker] = Number(ret.toFixed(2));
      });
    });
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  }, [series]);

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.15)" />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => new Date(v * 1000).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
            stroke="rgba(127,127,127,0.3)"
          />
          <YAxis
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
            stroke="rgba(127,127,127,0.3)"
          />
          <Tooltip
            contentStyle={{
              background: "rgba(24,24,27,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              fontSize: 11,
              color: "#fafafa",
            }}
            labelFormatter={(v) => new Date(Number(v) * 1000).toLocaleDateString("ko-KR")}
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v);
              return [`${n > 0 ? "+" : ""}${n.toFixed(2)}%`, undefined];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line
              key={s.ticker}
              type="monotone"
              dataKey={s.ticker}
              name={`${s.name} (${s.ticker})`}
              stroke={s.color ?? COLORS[i % COLORS.length]}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { COLORS };
