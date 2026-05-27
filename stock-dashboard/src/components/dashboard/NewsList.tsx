import { ExternalLink, Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketNews, getStockNews } from "@/lib/stocks/news";

interface NewsListProps {
  ticker?: string;
  title?: string;
  limit?: number;
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

export async function NewsList({ ticker, title, limit = 8 }: NewsListProps) {
  const items = ticker ? await getStockNews(ticker, limit) : await getMarketNews(limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          <span>{title ?? (ticker ? `${ticker} 관련 뉴스` : "시장 뉴스")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">표시할 뉴스가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item, i) => (
              <li key={`${item.link}-${i}`} className="py-2.5">
                <a
                  href={item.link}
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
