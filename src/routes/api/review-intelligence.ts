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
  analysisProvider?: "huggingface";
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

type SerpMapsResult = {
  title?: string;
  data_id?: string;
  place_id?: string;
  reviews_link?: string;
  rating?: number;
  reviews?: number;
  address?: string;
};

type SerpMapsResponse = {
  local_results?: SerpMapsResult[];
  place_results?: SerpMapsResult;
  error?: string;
};

type SerpReview = {
  link?: string;
  rating?: number;
  date?: string;
  iso_date?: string;
  source?: string;
  review_id?: string;
  snippet?: string;
  extracted_snippet?: {
    original?: string;
    translated?: string;
  };
};

type SerpReviewsResponse = {
  place_info?: {
    title?: string;
    rating?: number;
    reviews?: number;
  };
  reviews?: SerpReview[];
  error?: string;
};

type SerpOrganicResult = {
  title?: string;
  link?: string;
  source?: string;
  snippet?: string;
  date?: string;
  rating?: number;
  rich_snippet?: {
    top?: {
      detected_extensions?: {
        rating?: number;
        reviews?: number;
      };
      extensions?: string[];
    };
  };
};

type SerpSearchResponse = {
  organic_results?: SerpOrganicResult[];
  error?: string;
};

type HFChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type HFMessage = {
  role: "system" | "user";
  content: string;
};

type HFClassification = {
  sentiment: Sentiment;
  score: number;
};

const REVIEW_LIMIT = 10;
const REVIEW_SORTS = ["newestFirst", "qualityScore"] as const;

const TRUSTED_SOURCES = [
  { name: "Google Reviews", hosts: ["google.com", "maps.google.com"] },
  { name: "Hellopeter", hosts: ["hellopeter.com"] },
  { name: "Yelp", hosts: ["yelp.com"] },
  { name: "Trustpilot", hosts: ["trustpilot.com"] },
  { name: "Tripadvisor", hosts: ["tripadvisor.co.za", "tripadvisor.com"] },
  { name: "Restaurant Guru", hosts: ["restaurantguru.com"] },
  { name: "AfricaBizInfo", hosts: ["africabizinfo.com"] },
  { name: "Brabys", hosts: ["brabys.com"] },
  { name: "Cybo", hosts: ["cybo.com"] },
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
      "cliniccare.co.za",
      "netcare.co.za",
      "mediclinic.co.za",
    ],
  },
];

const REVIEW_SOURCE_SEARCHES = [
  { source: "Hellopeter", query: "site:hellopeter.com" },
  { source: "Yelp", query: "site:yelp.com" },
  { source: "Trustpilot", query: "site:trustpilot.com" },
  { source: "Tripadvisor", query: "site:tripadvisor.co.za OR site:tripadvisor.com" },
  { source: "Store locator reviews", query: "store locator reviews" },
  { source: "Official listing", query: "official reviews store listing" },
  { source: "Credible local reviews", query: "Cape Town customer reviews rating" },
] as const;

const SOURCE_PRIORITY: Record<string, number> = {
  "Google Reviews": 100,
  Hellopeter: 88,
  Yelp: 84,
  Trustpilot: 82,
  Tripadvisor: 80,
  "Store locator reviews": 74,
  "Official listing": 70,
  "Credible local reviews": 64,
};

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
    .replace(/â¦|Ã¢Â€Â¦/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[#*_`[\]()]/g, "")
    .trim();
}

function looksLikeCodeOrJson(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (/^(```|import\s|export\s|const\s|let\s|var\s|function\s|class\s|<script|<!doctype|<html)/i.test(text)) {
    return true;
  }
  if (/^\s*[{[]/.test(text) && /["'][\w-]+["']\s*:/.test(text)) return true;
  if (/"(?:error|reviews|sentiment|score|classifications)"\s*:/.test(text)) return true;
  return false;
}

function looksLikeBusinessReply(value: string) {
  return /\b(thanks? for (?:the )?(?:great )?review|thank you for (?:the )?(?:great )?review|we appreciate your review|we're glad you enjoyed|we are glad you enjoyed)\b/i.test(
    value,
  );
}

function cleanReviewText(value: string) {
  return cleanText(value)
    .replace(/\b(?:View|Read)\s+full\s+review\b/gi, "")
    .replace(/\b(?:Show|Read)\s+more\b/gi, "")
    .replace(/\s+[|·]\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulReviewText(value: string) {
  const text = cleanReviewText(value);
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, "").trim();
  if (looksLikeCodeOrJson(text)) return false;
  if (looksLikeBusinessReply(text)) return false;
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
  const source = (SOURCE_PRIORITY[b.source] ?? 0) - (SOURCE_PRIORITY[a.source] ?? 0);
  if (source !== 0) return source;
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

function clampScore(sentiment: Sentiment, value: unknown) {
  const score = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const signedScore =
    score >= 0 && score <= 1 && sentiment === "negative"
      ? -score
      : score >= 0 && score <= 1 && sentiment === "neutral"
        ? 0
        : score;
  return Number(Math.max(-1, Math.min(1, signedScore)).toFixed(2));
}

function normalizeSentiment(value: unknown): Sentiment | undefined {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "positive" || normalized === "negative" || normalized === "neutral") {
    return normalized;
  }
  return undefined;
}

function toClassifications(value: unknown): HFClassification[] | undefined {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? (value as { classifications?: unknown; reviews?: unknown; results?: unknown }).classifications ??
        (value as { reviews?: unknown }).reviews ??
        (value as { results?: unknown }).results
      : undefined;

  if (!Array.isArray(rows)) return undefined;

  return rows.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Hugging Face returned invalid JSON items");
    const sentiment = normalizeSentiment((item as { sentiment?: unknown }).sentiment);
    if (!sentiment) throw new Error("Hugging Face returned an invalid sentiment");
    return { sentiment, score: clampScore(sentiment, (item as { score?: unknown }).score) };
  });
}

function balancedJsonFrom(content: string, open: "[" | "{", close: "]" | "}") {
  const start = content.indexOf(open);
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return content.slice(start, index + 1);
  }

  return undefined;
}

function jsonCandidates(content: string) {
  return [
    ...[...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]),
    balancedJsonFrom(content, "[", "]"),
    balancedJsonFrom(content, "{", "}"),
    content.trim(),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));
}

function parseReviewClassifications(content: string, expected: number) {
  for (const candidate of jsonCandidates(content)) {
    try {
      const classifications = toClassifications(JSON.parse(candidate));
      if (classifications?.length === expected) return classifications;
    } catch {
      // Try the next possible JSON block from the model output.
    }
  }

  throw new Error("Hugging Face returned review classifications in an unreadable format");
}

async function requestHuggingFaceClassification(
  apiKey: string,
  model: string,
  messages: HFMessage[],
  maxTokens: number,
) {
  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error("Hugging Face could not classify the reviews");
    }

    const json = (await response.json()) as HFChatResponse;
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Hugging Face returned an empty review classification");
  return content;
}

async function classifyOneReviewWithHuggingFace(apiKey: string, model: string, review: Review) {
  const content = await requestHuggingFaceClassification(
    apiKey,
    model,
    [
      {
        role: "system",
        content:
          'Classify this customer review by meaning, not keywords. Return only this JSON shape: {"classifications":[{"sentiment":"positive|neutral|negative","score":0}]}',
      },
      { role: "user", content: review.text.slice(0, 900) },
    ],
    120,
  );

  return parseReviewClassifications(content, 1)[0];
}

async function analyzeWithHuggingFace(reviews: Review[], apiKey?: string) {
  if (!apiKey || reviews.length === 0) {
    throw new Error("HUGGINGFACE_API_KEY or HF_TOKEN is required for review classification");
  }

  try {
    const model = process.env.HUGGINGFACE_REVIEW_MODEL ?? "meta-llama/Llama-3.1-8B-Instruct";
    const content = await requestHuggingFaceClassification(
      apiKey,
      model,
      [
        {
          role: "system",
          content:
            'Classify customer reviews by meaning, not keywords. Return only JSON with this exact shape: {"classifications":[{"sentiment":"positive|neutral|negative","score":0}]}. The classifications array must contain one item per review, in the same order. No markdown. No explanation.',
        },
        {
          role: "user",
          content: reviews
            .map((review, index) => `${index + 1}. ${review.text.slice(0, 700)}`)
            .join("\n\n"),
        },
      ],
      900,
    );

    let classifications: HFClassification[];
    try {
      classifications = parseReviewClassifications(content, reviews.length);
    } catch {
      classifications = await Promise.all(
        reviews.map((review) => classifyOneReviewWithHuggingFace(apiKey, model, review)),
      );
    }

    return {
      provider: "huggingface" as const,
      reviews: reviews.map((review, index) => ({ ...review, ...classifications[index] })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown classification error";
    throw new Error(
      message.toLowerCase().includes("hugging face")
        ? message
        : `Hugging Face review classification failed: ${message}`,
    );
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
    reviews,
    fallback,
    analysisProvider,
  };
}

function serpApiUrl(params: Record<string, string | number | undefined>) {
  const url = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchSerpApi<T>(params: Record<string, string | number | undefined>) {
  const response = await fetch(serpApiUrl(params));
  const text = await response.text();
  let json: T & { error?: string };

  try {
    json = JSON.parse(text) as T & { error?: string };
  } catch {
    throw new Error(text || "SerpAPI returned an invalid response");
  }

  if (!response.ok || json.error) {
    throw new Error(json.error || text || "SerpAPI request failed");
  }

  return json;
}

async function findReviewPlaces(apiKey: string, query: string) {
  const json = await fetchSerpApi<SerpMapsResponse>({
    api_key: apiKey,
    engine: "google_maps",
    type: "search",
    q: `${query} Cape Town`,
    ll: "@-33.9249,18.4241,12z",
    hl: "en",
    gl: "za",
  });

  const results = json.local_results ?? (json.place_results ? [json.place_results] : []);
  return results
    .filter((result) => result.data_id || result.place_id)
    .sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0))
    .slice(0, 5);
}

function isUsefulSerpReviewText(value: string) {
  const text = cleanReviewText(value);
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, "").trim();
  if (looksLikeCodeOrJson(text)) return false;
  if (looksLikeBusinessReply(text)) return false;
  if (withoutUrls.length < 12 || withoutUrls.length > 1400) return false;
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(text)) return false;
  return !/\b(cookie|privacy policy|terms|sign in|log in|copyright|menu|advertise)\b/i.test(text);
}

function serpReviewText(review: SerpReview) {
  return cleanReviewText(
    review.extracted_snippet?.original ??
      review.extracted_snippet?.translated ??
      review.snippet ??
      "",
  );
}

function serpReviewToReview(review: SerpReview, place: SerpMapsResult, index: number): Review | null {
  const text = serpReviewText(review);
  if (!isUsefulSerpReviewText(text)) return null;

  const rating =
    typeof review.rating === "number" && Number.isFinite(review.rating)
      ? review.rating
      : extractRating(text);

  return {
    id: review.review_id ?? `${place.data_id ?? place.place_id}-${index}`,
    text,
    source: "Google Reviews",
    url: review.link ?? place.reviews_link ?? "#",
    rating,
    date: review.iso_date ?? review.date ?? extractDate(text),
    sentiment: "neutral",
    score: 0,
  };
}

function organicReviewText(result: SerpOrganicResult) {
  return cleanReviewText(result.snippet ?? result.title ?? "");
}

function sourceNameForOrganic(result: SerpOrganicResult, fallback: string) {
  const source = result.link ? sourceFor(result.link)?.name : undefined;
  return source ?? result.source ?? fallback;
}

function organicResultToReview(
  result: SerpOrganicResult,
  sourceLabel: string,
  index: number,
): Review | null {
  if (!result.link) return null;
  const trustedSource = sourceFor(result.link);
  if (!trustedSource) return null;

  const text = organicReviewText(result);
  if (!isUsefulReviewText(text)) return null;

  return {
    id: `${result.link}-${index}`,
    text,
    source: sourceNameForOrganic(result, sourceLabel),
    url: result.link,
    rating: result.rating ?? result.rich_snippet?.top?.detected_extensions?.rating ?? extractRating(text),
    date: result.date ?? extractDate(text),
    sentiment: "neutral",
    score: 0,
  };
}

async function collectOrganicReviews(apiKey: string, query: string) {
  const searchResults = await Promise.allSettled(
    REVIEW_SOURCE_SEARCHES.map(async (sourceSearch) => {
      const json = await fetchSerpApi<SerpSearchResponse>({
        api_key: apiKey,
        engine: "google",
        q: `${query} Cape Town ${sourceSearch.query} reviews rating -reddit -forum -blog -advertisement`,
        hl: "en",
        gl: "za",
        num: 8,
      });

      return (json.organic_results ?? [])
        .map((result, index) => organicResultToReview(result, sourceSearch.source, index))
        .filter((review): review is Review => Boolean(review));
    }),
  );

  return searchResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function collectReviews(apiKey: string, query: string) {
  const places = await findReviewPlaces(apiKey, query).catch(() => []);
  const mapsReviewGroups = await Promise.allSettled(
    places.flatMap((place) =>
      REVIEW_SORTS.map(async (sortBy) => {
        const json = await fetchSerpApi<SerpReviewsResponse>({
          api_key: apiKey,
          engine: "google_maps_reviews",
          data_id: place.data_id,
          place_id: place.data_id ? undefined : place.place_id,
          sort_by: sortBy,
          hl: "en",
        });

        return (json.reviews ?? [])
          .map((review, index) => serpReviewToReview(review, place, index))
          .filter((review): review is Review => Boolean(review));
      }),
    ),
  );
  const mapsReviews = mapsReviewGroups.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const organicReviews = await collectOrganicReviews(apiKey, query).catch(() => []);

  const uniqueReviews = [...mapsReviews, ...organicReviews]
    .filter(
      (review, index, arr) =>
        arr.findIndex(
          (item) =>
            item.text.toLowerCase() === review.text.toLowerCase() ||
            (item.id !== "" && item.id === review.id),
        ) === index,
    );

  return uniqueReviews.sort(reviewSort).slice(0, REVIEW_LIMIT);
}

function serpApiKey() {
  return (
    process.env.SERPAPI_API_KEY ??
    process.env.SERP_API_KEY ??
    process.env.SERPAPI_KEY ??
    process.env.SERPAPI_APIKEY
  );
}

export const Route = createFileRoute("/api/review-intelligence")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const serpKey = serpApiKey();
        if (!serpKey)
          return Response.json({ error: "SERPAPI_API_KEY not configured" }, { status: 500 });

        let body: { query?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const query = (body.query ?? "").toString().trim().slice(0, 120);
        if (!query) return Response.json({ error: "Search query required" }, { status: 400 });

        try {
          const collected = await collectReviews(serpKey, query);
          if (collected.length === 0) {
            return Response.json(buildAnalysis(query, [], false, undefined));
          }

          const analyzed = await analyzeWithHuggingFace(
            collected,
            process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN,
          ).catch(() => ({
            provider: undefined,
            reviews: collected.map((review) => ({ ...review, sentiment: "neutral" as const, score: 0 })),
          }));
          const analysis = buildAnalysis(
            query,
            analyzed.reviews,
            analyzed.provider !== "huggingface",
            analyzed.provider,
          );

          return Response.json(analysis);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (/hugging face|huggingface|hf_token|HUGGINGFACE_API_KEY/i.test(message)) {
            return Response.json(
              { error: message || "Hugging Face could not classify the reviews right now." },
              { status: 502 },
            );
          }

          const publicMessage = /(?:insufficient|credits|quota)/i.test(message)
            ? "SerpAPI has insufficient credits to collect real reviews right now."
            : "SerpAPI could not collect real Google review sources right now.";
          return Response.json({ error: publicMessage }, { status: 502 });
        }
      },
    },
  },
});
