import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Community Insights - CommunityHub" },
      {
        name: "description",
        content: "Real-time review intelligence for Cape Town community services and stores.",
      },
    ],
  }),
  component: InsightsPage,
});

type Sentiment = "positive" | "neutral" | "negative";

type Review = {
  id: string;
  text: string;
  source: string;
  url: string;
  date?: string;
  rating?: number;
  sentiment: Sentiment;
  score: number;
};

type Analysis = {
  businessName: string;
  totalReviews: number;
  ratingSummary?: number;
  averageSentimentScore: number;
  overallSentiment: Sentiment;
  percentages: Record<Sentiment, number>;
  indicators: {
    trust: number;
    satisfaction: number;
    complaintLevel: number;
    serviceQuality: number;
  };
  themes: Array<{ label: string; count: number; tone: Sentiment }>;
  reviews: Review[];
  cached?: boolean;
  fallback?: boolean;
  analysisProvider?: "huggingface" | "keyword-fallback";
};

const EXAMPLES = ["Checkers", "Woolworths", "Shoprite", "Dis-Chem", "Tygerberg Hospital"];

const EMPTY_ANALYSIS: Analysis = {
  businessName: "No search yet",
  totalReviews: 0,
  averageSentimentScore: 0,
  overallSentiment: "neutral",
  percentages: { positive: 0, neutral: 0, negative: 0 },
  indicators: { trust: 0, satisfaction: 0, complaintLevel: 0, serviceQuality: 0 },
  themes: [],
  reviews: [],
};

const SENTIMENT_META: Record<
  Sentiment,
  { label: string; dot: string; card: string; text: string; bar: string }
> = {
  positive: {
    label: "Positive",
    dot: "bg-emerald-400",
    card: "border-emerald-500/25 bg-emerald-500/10",
    text: "text-emerald-300",
    bar: "bg-emerald-400",
  },
  neutral: {
    label: "Neutral",
    dot: "bg-amber-300",
    card: "border-amber-500/25 bg-amber-500/10",
    text: "text-amber-200",
    bar: "bg-amber-300",
  },
  negative: {
    label: "Negative",
    dot: "bg-rose-400",
    card: "border-rose-500/25 bg-rose-500/10",
    text: "text-rose-300",
    bar: "bg-rose-400",
  },
};

function InsightsPage() {
  const [query, setQuery] = useState("Checkers");
  const [analysis, setAnalysis] = useState<Analysis>(EMPTY_ANALYSIS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chartData = useMemo(
    () => [
      { name: "Positive", value: analysis.percentages.positive, sentiment: "positive" as const },
      { name: "Neutral", value: analysis.percentages.neutral, sentiment: "neutral" as const },
      { name: "Negative", value: analysis.percentages.negative, sentiment: "negative" as const },
    ],
    [analysis],
  );

  async function runSearch(nextQuery = query) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/review-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Unable to analyze reviews right now");
      setAnalysis(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze reviews right now");
      setAnalysis({ ...EMPTY_ANALYSIS, businessName: trimmed });
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  const currentMeta = SENTIMENT_META[analysis.overallSentiment];

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Store Review Intelligence
            </div>
            <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
              Community Insights
            </h1>
            <p className="mt-1 max-w-2xl text-sm md:text-base text-muted-foreground">
              Search Cape Town stores, clinics, NGOs, and municipal services to analyze public
              review sentiment.
            </p>
          </div>

          <form onSubmit={onSubmit} className="w-full lg:max-w-xl">
            <div className="flex gap-2 rounded-xl border border-border bg-card/80 p-2 shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                  placeholder="Search Checkers, Dis-Chem, Tygerberg Hospital..."
                />
              </div>
              <Button type="submit" disabled={loading} className="h-10">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Analyze
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void runSearch(example)}
                  className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </form>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}. No review data is shown unless it comes from a trusted public source.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm transition">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Review Overview
                </div>
                <h2 className="mt-2 text-2xl font-semibold">{analysis.businessName}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{analysis.totalReviews} reviews analyzed</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <span>Avg sentiment {analysis.averageSentimentScore}</span>
                  {analysis.ratingSummary && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />{" "}
                        {analysis.ratingSummary}/5
                      </span>
                    </>
                  )}
                  {analysis.cached && <Badge variant="secondary">Cached</Badge>}
                  {analysis.analysisProvider === "huggingface" && (
                    <Badge variant="outline">Hugging Face analysis</Badge>
                  )}
                </div>
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${currentMeta.card} ${currentMeta.text}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${currentMeta.dot}`} />
                {currentMeta.label}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SentimentCard
                sentiment="positive"
                value={analysis.percentages.positive}
                icon={<ThumbsUp className="h-4 w-4" />}
              />
              <SentimentCard
                sentiment="neutral"
                value={analysis.percentages.neutral}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
              <SentimentCard
                sentiment="negative"
                value={analysis.percentages.negative}
                icon={<ThumbsDown className="h-4 w-4" />}
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Indicator label="Trust" value={analysis.indicators.trust} tone="positive" />
              <Indicator
                label="Satisfaction"
                value={analysis.indicators.satisfaction}
                tone="positive"
              />
              <Indicator
                label="Complaint level"
                value={analysis.indicators.complaintLevel}
                tone="negative"
              />
              <Indicator
                label="Service quality perception"
                value={analysis.indicators.serviceQuality}
                tone="neutral"
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Sentiment Stats
                </div>
                <h3 className="mt-1 text-lg font-semibold">Review distribution</h3>
              </div>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 6, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary))", opacity: 0.35 }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 3, 3]}>
                    {chartData.map((item) => (
                      <Cell
                        key={item.name}
                        fill={
                          item.sentiment === "positive"
                            ? "#34d399"
                            : item.sentiment === "neutral"
                              ? "#fbbf24"
                              : "#fb7185"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Common Themes & Keywords
            </div>
            <h3 className="mt-1 text-lg font-semibold">Community signals</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {analysis.themes.length === 0 && (
                <span className="text-sm text-muted-foreground">No themes detected yet.</span>
              )}
              {analysis.themes.map((theme) => (
                <span
                  key={theme.label}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${SENTIMENT_META[theme.tone].card} ${SENTIMENT_META[theme.tone].text}`}
                >
                  {theme.label} <span className="text-muted-foreground">x{theme.count}</span>
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Recent Reviews
                </div>
                <h3 className="mt-1 text-lg font-semibold">Full reviews and sources</h3>
              </div>
              <Badge variant="outline">{Math.min(analysis.reviews.length, 10)} max</Badge>
            </div>
            <ScrollArea className="mt-4 h-[380px] pr-3">
              <div className="space-y-3">
                {analysis.reviews.length === 0 && (
                  <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                    No trusted public reviews were found for this search.
                  </div>
                )}
                {analysis.reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            </ScrollArea>
          </section>
        </div>
      </div>
    </div>
  );
}

function SentimentCard({
  sentiment,
  value,
  icon,
}: {
  sentiment: Sentiment;
  value: number;
  icon: React.ReactNode;
}) {
  const meta = SENTIMENT_META[sentiment];
  return (
    <div className={`rounded-xl border p-4 ${meta.card}`}>
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-2 text-sm font-medium ${meta.text}`}>
          {icon}
          {meta.label}
        </span>
        <span className="text-2xl font-bold">{value}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
        <div
          className={`h-full rounded-full transition-all ${meta.bar}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Indicator({ label, value, tone }: { label: string; value: number; tone: Sentiment }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <Progress value={value} className="h-2 bg-secondary" />
      <div
        className={`mt-1 h-0.5 rounded-full ${SENTIMENT_META[tone].bar}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const meta = SENTIMENT_META[review.sentiment];

  return (
    <article className="rounded-lg border border-border bg-secondary/25 p-4 transition hover:bg-secondary/35">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.card} ${meta.text}`}
          >
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground">{review.source}</span>
          {review.date && <span className="text-xs text-muted-foreground">{review.date}</span>}
          {review.rating && (
            <span className="text-xs text-muted-foreground">{review.rating}/5</span>
          )}
        </div>
        {review.url !== "#" && (
          <a
            href={review.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Open review source
          </a>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
        {review.text}
      </p>
    </article>
  );
}
