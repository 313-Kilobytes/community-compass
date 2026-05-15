import { createFileRoute } from "@tanstack/react-router";
import { getServerEnv } from "@/lib/server/env";

type StoreStatus = "open" | "closed" | "closing-soon" | "unknown";

type StoreHours = {
  summary: string;
  today?: string;
  source: string;
  status: StoreStatus;
  statusLabel: string;
};

type Offer = {
  id: string;
  store: string;
  storeId: string;
  title: string;
  price: number;
  priceText: string;
  url: string;
  description: string;
  matchedQuery: string;
  image?: string;
  availability: string;
  storeLocation?: string;
  relevance: number;
  operatingHours: StoreHours;
};

type FCResult = { url: string; title: string; description?: string; markdown?: string };

type Retailer = {
  id: string;
  name: string;
  domains: string[];
  hours: Array<{ day: number; open: string; close: string }>;
  hoursSummary: string;
  locationHint?: string;
};

const cache = new Map<string, { at: number; data: Offer[] }>();
const hoursCache = new Map<string, { at: number; data: StoreHours }>();
const CACHE_VERSION = "trusted-v6";
const TTL = 1000 * 60 * 10;
const HOURS_TTL = 1000 * 60 * 5;

const RETAILERS: Retailer[] = [
  {
    id: "checkers",
    name: "Checkers",
    domains: ["checkers.co.za"],
    hours: standardHours("08:00", "20:00"),
    hoursSummary: "Typical stores: daily 08:00-20:00. Exact hours vary by branch.",
    locationHint: "Cape Town branches",
  },
  {
    id: "shoprite",
    name: "Shoprite",
    domains: ["shoprite.co.za"],
    hours: standardHours("08:00", "20:00"),
    hoursSummary: "Typical stores: daily 08:00-20:00. Exact hours vary by branch.",
    locationHint: "Cape Town branches",
  },
  {
    id: "pick-n-pay",
    name: "Pick n Pay",
    domains: ["pnp.co.za", "picknpay.co.za"],
    hours: [
      { day: 0, open: "07:00", close: "18:00" },
      { day: 1, open: "07:00", close: "18:30" },
      { day: 2, open: "07:00", close: "18:30" },
      { day: 3, open: "07:00", close: "18:30" },
      { day: 4, open: "07:00", close: "18:30" },
      { day: 5, open: "07:00", close: "18:30" },
      { day: 6, open: "07:00", close: "18:30" },
    ],
    hoursSummary: "Most areas: Mon-Sat 07:00-18:30, Sun 07:00-18:00.",
    locationHint: "Cape Town branches",
  },
  {
    id: "woolworths",
    name: "Woolworths",
    domains: ["woolworths.co.za"],
    hours: standardHours("09:00", "19:00"),
    hoursSummary: "Typical food stores: daily 09:00-19:00. Exact hours vary by branch.",
    locationHint: "Cape Town branches",
  },
  {
    id: "spar",
    name: "SPAR",
    domains: ["spar.co.za"],
    hours: standardHours("08:00", "20:00"),
    hoursSummary: "Typical stores: daily 08:00-20:00. Exact hours vary by branch.",
    locationHint: "Cape Town branches",
  },
  {
    id: "boxer",
    name: "Boxer",
    domains: ["boxer.co.za"],
    hours: standardHours("08:00", "19:00"),
    hoursSummary: "Typical stores: daily 08:00-19:00. Exact hours vary by branch.",
    locationHint: "Cape Town branches",
  },
  {
    id: "makro",
    name: "Makro",
    domains: ["makro.co.za"],
    hours: standardHours("08:00", "18:00"),
    hoursSummary: "Typical stores: daily 08:00-18:00. Exact hours vary by branch.",
    locationHint: "Cape Town branches",
  },
  {
    id: "food-lovers-market",
    name: "Food Lover's Market",
    domains: ["foodloversmarket.co.za"],
    hours: standardHours("08:00", "19:00"),
    hoursSummary: "Typical stores: daily 08:00-19:00. Exact hours vary by branch.",
    locationHint: "Cape Town branches",
  },
];

function firecrawlApiKey() {
  return getServerEnv("FIRECRAWL_API_KEY");
}

const PRICE_PATTERNS = [
  /(?:R|ZAR)\s?(\d{1,4}(?:[.,]\d{2}))/gi,
  /(?:R|ZAR)\s?(\d{1,4})(?!\d)/gi,
];

const BLOCKED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];
const PRODUCT_URL_HINTS = [
  "/p/",
  "/prd/",
  "/prod",
  "/product",
  "/products",
  "/shop/",
  "/catalog",
  "/special",
  "/deals",
  "/department",
  "/groceries",
  "/food",
  "/all-departments",
  "/pnpstorefront",
];
const NON_GROCERY_PRODUCT_SIGNALS = [
  "wicker",
  "plastic utility",
  "container",
  "lunch box",
  "hot water bottle",
  "warmer",
  "storage box",
  "basket set",
  "appliance",
];

function standardHours(open: string, close: string) {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open, close }));
}

function tokensFor(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9.]/g, ""))
    .filter((token) => token.length > 1);
}

function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return "";
  }
}

function retailerFor(url: string) {
  const host = hostnameFor(url);
  return RETAILERS.find((retailer) => retailer.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)));
}

function isTrustedProductResult(result: FCResult, query: string) {
  const retailer = retailerFor(result.url);
  if (!retailer) return false;

  let parsed: URL;
  try {
    parsed = new URL(result.url);
  } catch {
    return false;
  }

  const path = parsed.pathname.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((extension) => path.endsWith(extension))) return false;
  const text = `${result.title} ${result.description ?? ""} ${result.markdown ?? ""}`.toLowerCase();
  if (/\b(blog|news|facebook|reddit|forum|community|press release|recipe)\b/.test(text)) return false;
  const titleText = result.title.toLowerCase();
  if (NON_GROCERY_PRODUCT_SIGNALS.some((signal) => titleText.includes(signal))) return false;

  const tokens = tokensFor(query);
  if (tokens.length === 0) return false;
  const lastPathSegment = decodeURIComponent(path.split("/").filter(Boolean).at(-1) ?? "");
  const visibleProductText = `${result.title} ${lastPathSegment}`.toLowerCase();
  const hasProductPath = PRODUCT_URL_HINTS.some((hint) => path.includes(hint));
  const hasProductText = /\b(price|r\s?\d|add to cart|in stock|out of stock|buy now|product|special)\b/i.test(text);
  return tokens.every((token) => visibleProductText.includes(token)) && hasProductText && (hasProductPath || path.length > 8);
}

function extractPrices(text: string): number[] {
  const found: number[] = [];
  for (const re of PRICE_PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const price = Number.parseFloat(match[1].replace(",", "."));
      if (Number.isFinite(price) && price >= 1 && price <= 9999) found.push(price);
    }
  }
  return [...new Set(found)];
}

function extractImage(text: string, sourceUrl: string) {
  const image = text.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i)?.[1];
  if (image && !/logo|icon|sprite|placeholder/i.test(image)) return image;

  const htmlImage = text.match(/https?:\/\/[^\s)"']+\.(?:jpg|jpeg|png|webp)(?:\?[^\s)"']*)?/i)?.[0];
  if (htmlImage && !/logo|icon|sprite|placeholder/i.test(htmlImage)) return htmlImage;

  const retailer = retailerFor(sourceUrl);
  return retailer ? `https://www.google.com/s2/favicons?domain=${retailer.domains[0]}&sz=128` : undefined;
}

function extractAvailability(text: string) {
  if (/\b(out of stock|sold out|unavailable|currently unavailable)\b/i.test(text)) return "Out of stock";
  if (/\b(in stock|available|add to cart|buy now|available online)\b/i.test(text)) return "Available";
  return "Availability not shown";
}

function extractLocation(text: string, retailer: Retailer) {
  const capeTownLine = text.match(/(?:Cape Town|Western Cape|Claremont|Bellville|Milnerton|Sea Point|Somerset West)[^\n.]{0,80}/i)?.[0];
  return capeTownLine?.trim() || retailer.locationHint;
}

function relevanceScore(result: FCResult, query: string, price: number, retailer: Retailer) {
  const tokens = tokensFor(query);
  const title = result.title.toLowerCase();
  const description = (result.description ?? "").toLowerCase();
  const path = (() => {
    try {
      return new URL(result.url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (description.includes(token)) score += 3;
    if (path.includes(token)) score += 2;
  }
  if (retailer.domains.some((domain) => path.includes(domain.split(".")[0]))) score += 1;
  if (Number.isFinite(price)) score += 2;
  return score;
}

function normalizeProduct(title: string) {
  return title
    .toLowerCase()
    .replace(/\b(checkers|shoprite|pick n pay|pnp|woolworths|spar|boxer|makro|food lover'?s market)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeOffers(offers: Offer[]) {
  const seen = new Map<string, Offer>();
  for (const offer of offers) {
    const key = `${offer.storeId}|${normalizeProduct(offer.title)}`;
    const existing = seen.get(key);
    if (!existing || offer.relevance > existing.relevance || (offer.relevance === existing.relevance && offer.price < existing.price)) {
      seen.set(key, offer);
    }
  }
  return [...seen.values()];
}

function getCapeTownNow() {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { day: Math.max(0, day), minutes: hour * 60 + minute };
}

function operatingHoursFor(retailer: Retailer, source: string): StoreHours {
  const cached = hoursCache.get(retailer.id);
  if (cached && Date.now() - cached.at < HOURS_TTL) return cached.data;

  const now = getCapeTownNow();
  const today = retailer.hours.find((item) => item.day === now.day);
  const status = statusFromSchedule(today, now.minutes);
  const data = {
    summary: retailer.hoursSummary,
    today: today ? `Today ${today.open}-${today.close}` : "Closed today",
    source,
    ...status,
  };
  hoursCache.set(retailer.id, { at: Date.now(), data });
  return data;
}

function statusFromSchedule(
  today: { day: number; open: string; close: string } | undefined,
  currentMinutes: number,
): Pick<StoreHours, "status" | "statusLabel"> {
  if (!today) return { status: "closed", statusLabel: "Closed today" };
  const open = toMinutes(today.open);
  const close = toMinutes(today.close);
  if (currentMinutes < open) return { status: "closed", statusLabel: `Closed now. Opens ${today.open}` };
  if (currentMinutes >= close) return { status: "closed", statusLabel: `Closed now. Opens tomorrow` };
  if (close - currentMinutes <= 60) return { status: "closing-soon", statusLabel: `Closing soon. Closes ${today.close}` };
  return { status: "open", statusLabel: `Open now. Closes ${today.close}` };
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function searchRetailer(apiKey: string, query: string, retailer: Retailer): Promise<FCResult[]> {
  const domainQuery = `site:${retailer.domains[0]}`;
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `${domainQuery} ${query} price -facebook -reddit -forum -blog -news -pdf`,
      limit: 5,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: { web?: FCResult[] } | FCResult[];
  };
  return Array.isArray(json.data) ? json.data : json.data?.web ?? [];
}

async function searchExactItem(apiKey: string, query: string): Promise<Offer[]> {
  const settled = await Promise.all(RETAILERS.map((retailer) => searchRetailer(apiKey, query, retailer)));
  const results = settled.flat();

  const offers = results
    .filter((result) => isTrustedProductResult(result, query))
    .flatMap((result) => {
      const retailer = retailerFor(result.url);
      if (!retailer) return [];
      const text = `${result.title} ${result.description ?? ""} ${result.markdown ?? ""}`;
      const prices = extractPrices(text);
      if (prices.length === 0) return [];
      const price = prices[0];
      const title = result.title.replace(/\s*\|\s*.*$/, "").trim();
      const relevance = relevanceScore(result, query, price, retailer);

      return [{
        id: `${retailer.id}-${result.url}`,
        store: retailer.name,
        storeId: retailer.id,
        title,
        description: result.description ?? "",
        url: result.url,
        price,
        priceText: `R${price.toFixed(2)}`,
        matchedQuery: query,
        image: extractImage(text, result.url),
        availability: extractAvailability(text),
        storeLocation: extractLocation(text, retailer),
        relevance,
        operatingHours: operatingHoursFor(retailer, result.url),
      }];
    });

  return dedupeOffers(offers)
    .sort((a, b) => b.relevance - a.relevance || a.price - b.price)
    .slice(0, 12);
}

export const Route = createFileRoute("/api/groceries")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = firecrawlApiKey();
        if (!apiKey) return Response.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });

        let body: { query?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const query = (body.query ?? "").toString().trim().slice(0, 120);
        if (!query) return Response.json({ offers: [] });

        const cacheKey = `${CACHE_VERSION}|${query.toLowerCase()}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) return Response.json({ offers: hit.data, cached: true, exactQuery: query });

        const offers = await searchExactItem(apiKey, query);
        cache.set(cacheKey, { at: Date.now(), data: offers });
        return Response.json({ offers, exactQuery: query });
      },
    },
  },
});
