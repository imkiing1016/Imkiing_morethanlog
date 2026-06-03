import { ExternalLink, Newspaper, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketNews, getStockNews } from "@/lib/stocks/news";
import { summarizeHeadlines } from "@/lib/ai/headline-summary";

interface NewsListProps {
  ticker?: string;
  title?: string;
  limit?: number;
  market?: "KR" | "US";
  /** 상단에 AI 한 줄 요약 표시 */
  aiSummary?: boolean;
  /** AI 요약에 쓸 라벨 */
  summaryLabel?: string;
}

/** 링크가 비어있거나 더미("#")면 네이버 뉴스 검색으로 대체 */
function safeHref(link: string | undefined, title: string): string {
  if (!link || link === "#" || !/^https?:\/\//.test(link)) {
    return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(title)}`;
  }
  return link;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export async function NewsList({
  ticker,
  title,
  limit = 8,
  market = "KR",
  aiSummary = false,
  summaryLabel,
}: NewsListProps) {
  const items = ticker ? await getStockNews(ticker, limit) : await getMarketNews(limit, market);
  const summary =
    aiSummary && items.length > 0
      ? await summarizeHeadlines(items, summaryLabel ?? (ticker ? ticker : "시장")).catch(() => null)
      : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          <span>{title ?? (ticker ? `${ticker} 관련 뉴스` : "시장 뉴스")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary && summary.text ? (
          <div className="mb-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-500">
              <Sparkles className="h-3 w-3" /> AI 한 줄 요약
              <span className="font-normal text-zinc-400">
                {summary.source === "local" ? "· 로컬 LLM" : "· 자동"}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
              {summary.text}
            </p>
          </div>
        ) : null}
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">표시할 뉴스가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item, i) => (
              <li key={`${item.link}-${i}`} className="py-2.5">
                <a
                  href={safeHref(item.link, item.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 font-medium leading-snug group-hover:text-violet-500">
                      {item.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                      {item.source ? <span>{item.source}</span> : null}
                      <span>·</span>
                      <span>{timeAgo(item.publishedAt)}</span>
                    </div>
                  </div>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
