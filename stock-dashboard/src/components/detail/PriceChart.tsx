"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { Candle } from "@/types/stock";
import { sma } from "@/lib/stocks/indicators";

interface PriceChartProps {
  candles: Candle[];
  isKr: boolean;
  showMA?: boolean;
}

export function PriceChart({ candles, isKr, showMA = true }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const isDark = document.documentElement.classList.contains("dark");
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#52525b",
      },
      grid: {
        vertLines: { color: isDark ? "#27272a" : "#f4f4f5" },
        horzLines: { color: isDark ? "#27272a" : "#f4f4f5" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false },
    });
    chartRef.current = chart;

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceFormat: {
        type: "price",
        precision: isKr ? 0 : 2,
        minMove: isKr ? 1 : 0.01,
      },
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "#71717a",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color:
          c.close >= c.open ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
      })),
    );

    if (showMA) {
      const palette: [number, string][] = [
        [20, "#3b82f6"],
        [60, "#f97316"],
        [120, "#a855f7"],
      ];
      for (const [period, color] of palette) {
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        series.setData(
          sma(candles, period).map((p) => ({
            time: p.time as Time,
            value: p.value,
          })),
        );
      }
    }

    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, isKr, showMA]);

  return <div ref={containerRef} className="h-[420px] w-full" />;
}
