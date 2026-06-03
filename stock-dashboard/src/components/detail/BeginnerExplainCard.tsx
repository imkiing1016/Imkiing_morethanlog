import {
  TrendingUp,
  BarChart3,
  Activity,
  Gauge,
  Newspaper,
  Scale,
  Info,
  GraduationCap,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStockNews } from "@/lib/stocks/news";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { explainStock, type ExplainIcon, type ExplainTone } from "@/lib/stocks/explain";
import type { Candle, Market, Quote } from "@/types/stock";

interface BeginnerExplainCardProps {
  quote: Quote;
  candles: Candle[];
  ticker: string;
  market: Market;
}

const ICONS: Record<ExplainIcon, typeof TrendingUp> = {
  summary: Zap,
  price: TrendingUp,
  volume: BarChart3,
  trend: Activity,
  rsi: Gauge,
  news: Newspaper,
  valuation: Scale,
  caution: Info,
};

function toneClasses(tone: ExplainTone): string {
  if (tone === "up") return "border-emerald-500/30 bg-emerald-500/5";
  if (tone === "down") return "border-rose-500/30 bg-rose-500/5";
  return "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40";
}

function iconColor(tone: ExplainTone): string {
  if (tone === "up") return "text-emerald-500";
  if (tone === "down") return "text-rose-500";
  return "text-zinc-500";
}

export async function BeginnerExplainCard({ quote, candles, ticker, market }: BeginnerExplainCardProps) {
  const [news, fundamentals] = await Promise.all([
    getStockNews(ticker, 5).catch(() => []),
    getFundamentals(ticker).catch(() => undefined),
  ]);
  const items = explainStock({ quote, candles, news, fundamentals });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-violet-500" /> 초보자를 위한 쉬운 해설
        </CardTitle>
        <p className="text-xs text-zinc-500">차트·거래량·뉴스를 쉬운 말로 풀어서 설명해요</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 ${toneClasses(item.tone)} ${
                  item.icon === "summary" || item.icon === "caution" || item.icon === "news"
                    ? "sm:col-span-2"
                    : ""
                } ${item.icon === "summary" ? "border-violet-500/30 bg-violet-500/5" : ""}`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                  <Icon className={`h-3.5 w-3.5 ${iconColor(item.tone)}`} />
                  {item.title}
                </div>
                <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
