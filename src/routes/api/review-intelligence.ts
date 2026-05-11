import { createFileRoute } from "@tanstack/react-router";

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

type FCResult = {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
};

type FCScrapeResponse = {
  data?: {
    markdown?: string;
    metadata?: { title?: string; sourceURL?: string };
  };
  markdown?: string;
};

type HFResponse =
  | Array<Array<{ label: string; score: number }>>
  | Array<{ label: string; score: number }>;

const cache = new Map<string, { at: number; data: Analysis }>();
const TTL = 1000 * 60 * 30;
const REVIEW_LIMIT = 10;

const TRUSTED_SOURCES = [
  { name: "Google Reviews", hosts: ["google.com", "maps.google.com"] },
  { name: "Hellopeter", hosts: ["hellopeter.com"] },
  { name: "Facebook Reviews", hosts: ["facebook.com"] },
  { name: "Tripadvisor", hosts: ["tripadvisor.co.za", "tripadvisor.com"] },
  {
    name: "Official listing",
    hosts: [
      "checkers.co.za",
      "shoprite.co.za",
      "woolworths.co.za",
      "pnp.co.za",
      "picknpay.co.za",
      "spar.co.za",
      "dischem.co.za",
      "westerncape.gov.za",
      "capetown.gov.za",
    ],
  },
];

const POSITIVE_WORDS = [
  "helpful",
  "friendly",
  "clean",
  "quick",
  "affordable",
  "fresh",
  "excellent",
  "great",
  "kind",
  "professional",
  "organized",
  "caring",
  "safe",
];
const NEGATIVE_WORDS = [
  "slow",
  "rude",
  "dirty",
  "expensive",
  "queue",
  "queues",
  "wait",
  "waiting",
  "complaint",
  "poor",
  "unhelpful",
  "crowded",
  "stock",
];

const THEME_PATTERNS: Array<{ label: string; tone: Sentiment; keys: string[] }> = [
  {
    label: "Long queues",
    tone: "negative",
    keys: ["long queue", "long queues", "queue", "queues", "waiting", "wait time"],
  },
  {
    label: "Helpful staff",
    tone: "positive",
    keys: ["helpful staff", "friendly staff", "kind staff", "professional staff", "caring"],
  },
  { label: "Clean store", tone: "positive", keys: ["clean", "neat", "tidy", "hygienic"] },
  {
    label: "Slow service",
    tone: "negative",
    keys: ["slow service", "slow", "delayed", "takes long"],
  },
  {
    label: "Affordable prices",
    tone: "positive",
    keys: ["affordable", "good prices", "cheap", "value", "reasonable"],
  },
  {
    label: "Stock availability",
    tone: "neutral",
    keys: ["stock", "available", "shelves", "out of stock"],
  },
  {
    label: "Service complaints",
    tone: "negative",
    keys: ["complaint", "rude", "unhelpful", "poor service"],
  },
  {
    label: "Fresh products",
    tone: "positive",
    keys: ["fresh", "quality produce", "bakery", "meat"],
  },
];

function sourceFor(url: string) {
  const host = hostnameFor(url);
  return TRUSTED_SOURCES.find((source) =>
    source.hosts.some((trustedHost) => host === trustedHost || host.endsWith(`.${trustedHost}`)),
  );
}

function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return "";
  }
}

function cleanText(value: string) {
  return value
    .replace(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/g, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/â/g, "'")
    .replace(/â/g, "-")
    .replace(/â/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[#*_`[\]()]/g, "")
    .trim();
}

function isUsefulReviewText(value: string) {
  const text = cleanText(value);
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, "").trim();
  if (withoutUrls.length < 45 || withoutUrls.length > 900) return false;
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(text)) return false;
  if ((text.match(/https?:\/\/|www\./gi)?.length ?? 0) > 1) return false;
  if (
    /\b(cookie|privacy policy|terms|sign in|log in|copyright|menu|advertise|install|downloads?|add to wishlist|screenshot|trailer|content rating|learn more|personalised deals|delivered|famously low prices|skip to main content|travelers'? choice|things to do|aboutthe area|review snippets are selected by ai)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/^\d+\s+people found this review helpful\b/i.test(text)) {
    return false;
  }
  return /\b(review|rated|stars?|service|staff|store|queue|clean|price|helpful|slow|friendly|complaint|experience|visited|customer|clinic|hospital)\b/i.test(
    text,
  );
}

function normalizeReviewCandidate(value: string) {
  return cleanText(value)
    .replace(/Read more\s+Written\s+.*?This review is the subjective opinion.*?(?:Tripadvisor LLC\.?)?/gi, "")
    .replace(/Written\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}.*?Tripadvisor LLC\.?/gi, "")
    .replace(/This review is the subjective opinion.*?(?:Tripadvisor LLC\.?)?/gi, "")
    .replace(/See all\s+\d+\s+photos/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRating(text: string) {
  const match = text.match(
    /(?:rating|rated|score)?\s*(\d(?:[.,]\d)?)\s*(?:\/\s*5|stars?|star rating)/i,
  );
  if (!match) return undefined;
  const rating = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : undefined;
}

function extractDate(text: string) {
  const relative = text.match(
    /\b(?:today|yesterday|\d+\s+(?:day|week|month|year)s?\s+ago)\b/i,
  )?.[0];
  if (relative) return relative;
  return text.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
  )?.[0];
}

function recencyScore(date?: string) {
  if (!date) return 0;
  const lower = date.toLowerCase();
  const now = Date.now();
  if (lower === "today") return now;
  if (lower === "yesterday") return now - 1000 * 60 * 60 * 24;

  const relative = lower.match(/(\d+)\s+(day|week|month|year)s?\s+ago/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const days =
      unit === "day"
        ? amount
        : unit === "week"
          ? amount * 7
          : unit === "month"
            ? amount * 30
            : amount * 365;
    return now - days * 1000 * 60 * 60 * 24;
  }

  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function reviewSort(a: Review, b: Review) {
  const recent = recencyScore(b.date) - recencyScore(a.date);
  if (recent !== 0) return recent;
  return b.text.length - a.text.length;
}

function paragraphCandidates(markdown: string) {
  const paragraphs = markdown
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z"'])|•/g)
    .map(normalizeReviewCandidate)
    .filter(isUsefulReviewText);

  const sentences = markdown
    .split(/(?<=\.)\s+|[\n\r]+|•/g)
    .map(normalizeReviewCandidate)
    .filter(isUsefulReviewText);

  return [...paragraphs, ...sentences]
    .map((candidate) => candidate.replace(/\s*Read more\s*$/i, "").trim())
    .filter(
      (candidate, index, arr) =>
        arr.findIndex((item) => item.toLowerCase() === candidate.toLowerCase()) === index,
    );
}

function resultToReviews(result: FCResult): Review[] {
  const source = sourceFor(result.url);
  if (!source) return [];
  if (source.name === "Official listing") return [];

  const markdown = result.markdown ? cleanText(result.markdown) : "";
  if (!markdown || /\b(forum|reddit|blog|press release|advertisement)\b/i.test(markdown)) return [];

  const titleStart = result.title.toLowerCase().slice(0, 24);
  const candidates = paragraphCandidates(markdown)
    .filter((line) => !line.toLowerCase().includes(titleStart))
    .sort((a, b) => recencyScore(extractDate(b)) - recencyScore(extractDate(a)));

  return candidates.slice(0, 3).map((snippet, index) => ({
    id: `${result.url}-${index}`,
    text: snippet,
    source: source.name,
    url: result.url,
    rating: extractRating(snippet),
    date: extractDate(snippet),
    sentiment: "neutral",
    score: 0,
  }));
}

function fallbackSentiment(text: string): Pick<Review, "sentiment" | "score"> {
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.reduce((total, word) => total + (lower.includes(word) ? 1 : 0), 0);
  const neg = NEGATIVE_WORDS.reduce((total, word) => total + (lower.includes(word) ? 1 : 0), 0);
  const raw = (pos - neg) / Math.max(1, pos + neg);
  const sentiment = raw > 0.18 ? "positive" : raw < -0.18 ? "negative" : "neutral";
  return { sentiment, score: Number(raw.toFixed(2)) };
}

function normalizeHFLabel(label: string): Sentiment {
  const upper = label.toUpperCase();
  if (upper.includes("POS") || upper === "LABEL_2" || upper.includes("5") || upper.includes("4"))
    return "positive";
  if (upper.includes("NEG") || upper === "LABEL_0" || upper.includes("1") || upper.includes("2"))
    return "negative";
  return "neutral";
}

function scoreFor(sentiment: Sentiment, confidence: number) {
  const value = sentiment === "positive" ? confidence : sentiment === "negative" ? -confidence : 0;
  return Number(value.toFixed(2));
}

async function analyzeWithHuggingFace(reviews: Review[], apiKey?: string) {
  if (!apiKey || reviews.length === 0) {
    return {
      provider: "keyword-fallback" as const,
      reviews: reviews.map((review) => ({ ...review, ...fallbackSentiment(review.text) })),
    };
  }

  try {
    const rows = await Promise.all(
      reviews.map(async (review) => {
        const response = await fetch(
          "https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment-latest",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: review.text.slice(0, 450) }),
          },
        );

        if (!response.ok) throw new Error("Hugging Face sentiment request failed");
        const json = (await response.json()) as HFResponse;
        return Array.isArray(json[0])
          ? (json[0] as Array<{ label: string; score: number }>)
          : (json as Array<{ label: string; score: number }>);
      }),
    );

    return {
      provider: "huggingface" as const,
      reviews: reviews.map((review, index) => {
        const best = [...(rows[index] ?? [])].sort((a, b) => b.score - a.score)[0];
        if (!best) return { ...review, ...fallbackSentiment(review.text) };
        const sentiment = normalizeHFLabel(best.label);
        return { ...review, sentiment, score: scoreFor(sentiment, best.score) };
      }),
    };
  } catch {
    return {
      provider: "keyword-fallback" as const,
      reviews: reviews.map((review) => ({ ...review, ...fallbackSentiment(review.text) })),
    };
  }
}

function extractThemes(reviews: Review[]) {
  const counts = new Map<string, { count: number; tone: Sentiment }>();
  const text = reviews.map((review) => review.text.toLowerCase()).join(" ");

  for (const theme of THEME_PATTERNS) {
    const count = theme.keys.reduce((total, key) => total + (text.includes(key) ? 1 : 0), 0);
    if (count > 0) counts.set(theme.label, { count, tone: theme.tone });
  }

  const words = text
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 4 &&
        !["review", "store", "service", "google", "official", "cape", "town"].includes(word),
    );

  for (const word of words) {
    counts.set(word, { count: (counts.get(word)?.count ?? 0) + 1, tone: "neutral" });
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([label, value]) => ({ label, ...value }));
}

function buildAnalysis(
  businessName: string,
  reviews: Review[],
  fallback: boolean,
  analysisProvider: Analysis["analysisProvider"],
): Analysis {
  if (reviews.length === 0) {
    return {
      businessName,
      totalReviews: 0,
      averageSentimentScore: 0,
      overallSentiment: "neutral",
      percentages: { positive: 0, neutral: 0, negative: 0 },
      indicators: { trust: 0, satisfaction: 0, complaintLevel: 0, serviceQuality: 0 },
      themes: [],
      reviews: [],
      fallback,
      analysisProvider,
    };
  }

  const total = Math.max(1, reviews.length);
  const counts = {
    positive: reviews.filter((review) => review.sentiment === "positive").length,
    neutral: reviews.filter((review) => review.sentiment === "neutral").length,
    negative: reviews.filter((review) => review.sentiment === "negative").length,
  };
  const averageSentimentScore = Number(
    (reviews.reduce((sum, review) => sum + review.score, 0) / total).toFixed(2),
  );
  const ratingValues = reviews
    .map((review) => review.rating)
    .filter((rating): rating is number => typeof rating === "number");
  const positivePercent = Math.round((counts.positive / total) * 100);
  const negativePercent = Math.round((counts.negative / total) * 100);

  return {
    businessName,
    totalReviews: reviews.length,
    ratingSummary: ratingValues.length
      ? Number(
          (ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1),
        )
      : undefined,
    averageSentimentScore,
    overallSentiment:
      averageSentimentScore > 0.18
        ? "positive"
        : averageSentimentScore < -0.18
          ? "negative"
          : "neutral",
    percentages: {
      positive: positivePercent,
      neutral: Math.round((counts.neutral / total) * 100),
      negative: negativePercent,
    },
    indicators: {
      trust: Math.max(5, Math.min(98, positivePercent + Math.round((counts.neutral / total) * 25))),
      satisfaction: Math.max(5, Math.min(98, Math.round(((averageSentimentScore + 1) / 2) * 100))),
      complaintLevel: Math.max(2, Math.min(98, negativePercent)),
      serviceQuality: Math.max(
        5,
        Math.min(
          98,
          positivePercent +
            (reviews.some((review) => /staff|service|helpful|friendly/i.test(review.text))
              ? 12
              : 0),
        ),
      ),
    },
    themes: extractThemes(reviews),
    reviews: [...reviews].sort(reviewSort),
    fallback,
    analysisProvider,
  };
}

async function collectReviews(apiKey: string, query: string) {
  const searches = [
    `${query} Cape Town Google reviews rating`,
    `${query} Cape Town recent reviews rating service`,
    `site:hellopeter.com ${query} Cape Town recent reviews`,
    `site:google.com/maps ${query} Cape Town latest reviews`,
    `${query} Cape Town official store listing reviews`,
  ];

  const results = await Promise.all(
    searches.map(async (search) => {
      const response = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${search} 2026 2025 -reddit -forum -blog`,
          limit: 6,
          scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Firecrawl could not fetch review sources");
      }
      const json = (await response.json()) as { data?: { web?: FCResult[] } | FCResult[] };
      return Array.isArray(json.data) ? json.data : (json.data?.web ?? []);
    }),
  );

  const seen = new Set<string>();
  const trustedResults = results
    .flat()
    .filter((result) => {
      if (seen.has(result.url)) return false;
      seen.add(result.url);
      return Boolean(sourceFor(result.url));
    })
    .slice(0, 12);

  const scrapedResults = await Promise.all(
    trustedResults.map((result) => scrapeTrustedResult(apiKey, result)),
  );

  return scrapedResults
    .flatMap(resultToReviews)
    .filter(
      (review, index, arr) =>
        arr.findIndex((item) => item.text.toLowerCase() === review.text.toLowerCase()) === index,
    )
    .sort(reviewSort)
    .slice(0, REVIEW_LIMIT);
}

async function scrapeTrustedResult(apiKey: string, result: FCResult): Promise<FCResult> {
  if (result.markdown) return result;

  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: result.url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!response.ok) return result;

    const json = (await response.json()) as FCScrapeResponse;
    return {
      ...result,
      title: result.title || json.data?.metadata?.title || "",
      url: json.data?.metadata?.sourceURL || result.url,
      markdown: json.data?.markdown ?? json.markdown,
    };
  } catch {
    return result;
  }
}

export const Route = createFileRoute("/api/review-intelligence")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const firecrawlKey = process.env.FIRECRAWL_API_KEY;
        if (!firecrawlKey)
          return Response.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });

        let body: { query?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const query = (body.query ?? "").toString().trim().slice(0, 120);
        if (!query) return Response.json({ error: "Search query required" }, { status: 400 });

        const cacheKey = query.toLowerCase();
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) return Response.json({ ...hit.data, cached: true });

        try {
          const collected = await collectReviews(firecrawlKey, query);
          const analyzed = await analyzeWithHuggingFace(
            collected,
            process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN,
          );
          const analysis = buildAnalysis(
            query,
            analyzed.reviews,
            analyzed.provider !== "huggingface",
            analyzed.provider,
          );

          cache.set(cacheKey, { at: Date.now(), data: analysis });
          return Response.json(analysis);
        } catch (error) {
          const message =
            error instanceof Error && /insufficient credits/i.test(error.message)
              ? "Firecrawl has insufficient credits to collect real reviews right now."
              : "Firecrawl could not collect real review sources right now.";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
