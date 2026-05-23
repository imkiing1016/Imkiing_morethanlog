"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { Candle } from "@/types/stock";
import { macd, rsi, sma } from "@/lib/stocks/indicators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IndicatorPanelProps {
  candles: Candle[];
}

export function IndicatorPanel({ candles }: IndicatorPanelProps) {
  const rsiData = useMemo(() => rsi(candles, 14), [candles]);
  const macdData = useMemo(() => macd(candles), [candles]);
  const ma20 = useMemo(() => sma(candles, 20).at(-1)?.value, [candles]);
  const ma60 = useMemo(() => sma(candles, 60).at(-1)?.value, [candles]);
  const ma120 = useMemo(() => sma(candles, 120).at(-1)?.value, [candles]);
  const lastRsi = rsiData.at(-1)?.value;
  const lastMacd = macdData.at(-1);
  const lastClose = candles.at(-1)?.close;

  const rsiSeries = rsiData.slice(-90).map((p) => ({ x: p.time, y: p.value }));
  const macdSeries = macdData.slice(-90).map((p) => ({
    x: p.time,
    macd: p.macd,
    signal: p.signal,
    histogram: p.histogram,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>RSI (14)</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {lastRsi?.toFixed(1) ?? "-"}
            </span>
            {lastRsi != null ? (
              <Badge tone={lastRsi >= 70 ? "down" : lastRsi <= 30 ? "up" : "default"}>
                {lastRsi >= 70 ? "과매수" : lastRsi <= 30 ? "과매도" : "중립"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer>
              <LineChart data={rsiSeries} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="x" hide />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 12 }}
                  labelFormatter={(v) => new Date((v as number) * 1000).toLocaleDateString()}
                  formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))}
                />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" />
                <Line dataKey="y" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MACD (12, 26, 9)</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums text-zinc-500">
              MACD <strong className="text-zinc-100">{lastMacd?.macd.toFixed(3) ?? "-"}</strong>
            </span>
            <span className="text-sm tabular-nums text-zinc-500">
              Signal <strong className="text-zinc-100">{lastMacd?.signal.toFixed(3) ?? "-"}</strong>
            </span>
            {lastMacd ? (
              <Badge tone={lastMacd.histogram >= 0 ? "up" : "down"}>
                {lastMacd.histogram >= 0 ? "골든" : "데드"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={macdSeries} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="x" hide />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 12 }}
                  labelFormatter={(v) => new Date((v as number) * 1000).toLocaleDateString()}
                  formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))}
                />
                <ReferenceLine y={0} stroke="#52525b" />
                <Bar dataKey="histogram" radius={[2, 2, 0, 0]}>
                  {macdSeries.map((m) => (
                    <Cell
                      key={String(m.x)}
                      fill={m.histogram >= 0 ? "#10b981" : "#ef4444"}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>이동평균선</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MAStat label="현재가" value={lastClose} />
            <MAStat label="MA20" value={ma20} reference={lastClose} color="#3b82f6" />
            <MAStat label="MA60" value={ma60} reference={lastClose} color="#f97316" />
            <MAStat label="MA120" value={ma120} reference={lastClose} color="#a855f7" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MAStat({
  label,
  value,
  reference,
  color,
}: {
  label: string;
  value?: number;
  reference?: number;
  color?: string;
}) {
  const diff =
    value != null && reference != null ? ((reference - value) / value) * 100 : null;
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : null}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums">
        {value != null ? value.toFixed(2) : "-"}
      </div>
      {diff != null ? (
        <div
          className={`text-[10px] tabular-nums ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}
        >
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(2)}%
        </div>
      ) : null}
    </div>
  );
}
