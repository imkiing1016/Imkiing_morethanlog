import { WatchlistGrid } from "@/components/dashboard/WatchlistGrid";
import { SentimentGauge } from "@/components/dashboard/SentimentGauge";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <section className="grid gap-4 lg:grid-cols-2">
        <SentimentGauge market="KR" />
        <SentimentGauge market="US" />
      </section>
      <WatchlistGrid />
    </div>
  );
}
