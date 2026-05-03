import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { resources, reviews } from "@/data/resources";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Community Insights — CommunityHub" },
      { name: "description", content: "Sentiment and feedback themes for community resources." },
    ],
  }),
  component: InsightsPage,
});

const POS = ["helpful", "kind", "great", "amazing", "friendly", "clean", "love", "caring", "calm", "grateful", "dedicated", "affordable", "fresh", "worth", "understanding"];
const NEG = ["long", "crowded", "wait", "hard", "lines", "queues", "slow", "rude", "dirty", "expensive"];

const themeKeywords: Record<string, string[]> = {
  "Long queues": ["long", "queue", "queues", "lines", "wait"],
  "Helpful staff": ["helpful", "kind", "friendly", "caring", "dedicated"],
  "Affordability": ["affordable", "free", "sliding", "scholarship"],
  "Cleanliness": ["clean", "facility"],
  "Crowded": ["crowded"],
};

function analyze(items: { text: string }[]) {
  let pos = 0, neg = 0;
  const themes: Record<string, number> = {};
  for (const r of items) {
    const w = r.text.toLowerCase();
    for (const p of POS) if (w.includes(p)) pos++;
    for (const n of NEG) if (w.includes(n)) neg++;
    for (const [theme, keys] of Object.entries(themeKeywords)) {
      if (keys.some((k) => w.includes(k))) themes[theme] = (themes[theme] || 0) + 1;
    }
  }
  const total = pos + neg || 1;
  const score = (pos - neg) / total;
  const sentiment = score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
  const topThemes = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
  return { sentiment, pos, neg, topThemes, score };
}

const reviewable = resources.filter((r) => reviews[r.id]?.length);

function InsightsPage() {
  const [selectedId, setSelectedId] = useState(reviewable[0]?.id ?? "");
  const selected = reviewable.find((r) => r.id === selectedId)!;
  const items = reviews[selectedId] ?? [];
  const result = useMemo(() => analyze(items), [items]);

  const sentColor = result.sentiment === "positive" ? "bg-success/20 text-[color:var(--success)]"
    : result.sentiment === "negative" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Community Insights</h1>
      <p className="text-muted-foreground mt-1">Lightweight sentiment & feedback themes from community reviews.</p>

      <div className="mt-6 grid md:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase">Select resource</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {reviewable.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Resource</div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selected.location}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${sentColor}`}>
                {result.sentiment}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5">
              <Stat label="Reviews" value={items.length} />
              <Stat label="Positive" value={result.pos} />
              <Stat label="Negative" value={result.neg} />
            </div>

            <div className="mt-5">
              <div className="text-xs font-medium text-muted-foreground uppercase mb-2">Common themes</div>
              <div className="flex flex-wrap gap-2">
                {result.topThemes.length === 0 && <span className="text-sm text-muted-foreground">No themes detected.</span>}
                {result.topThemes.map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-sm font-semibold mb-3">Recent feedback</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {items.map((r, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-3">"{r.text}"</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}
