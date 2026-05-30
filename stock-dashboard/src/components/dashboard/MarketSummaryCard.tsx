import { Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMarketIndices } from "@/lib/stocks/markets";
import { getMarketNews } from "@/lib/stocks/news";
import { buildMarketSummary } from "@/lib/ai/market-summary";

export async function MarketSummaryCard() {
  const [news, indices] = await Promise.all([getMarketNews(12), getMarketIndices()]);
  const s = await buildMarketSummary({ news, indices });

  const SentIcon = s.sentiment === "긍정" ? TrendingUp : s.sentiment === "부정" ? TrendingDown : Minus;
  const sentTone = s.sentiment === "긍정" ? "up" : s.sentiment === "부정" ? "down" : "warning";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> 오늘의 시장 요약
          </span>
          <span className="flex items-center gap-2">
            <Badge tone={sentTone as "up" | "down" | "warning"}>
              <SentIcon className="mr-1 inline h-3 w-3" />
              {s.sentiment}
            </Badge>
            <span className="text-[10px] font-normal text-zinc-500">
              {s.source === "local" ? "로컬 LLM" : "자동 요약"}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium leading-snug">{s.headline}</p>
        <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          {s.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-violet-500">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {s.themes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {s.themes.map((t) => (
              <span
                key={t}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
        {s.source === "heuristic" ? (
          <p className="text-[10px] text-zinc-400">
            로컬 LLM(Ollama) 실행 시 뉴스·지표를 종합한 요약을 자동 생성합니다.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
