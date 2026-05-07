import { createFileRoute } from "@tanstack/react-router";

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
};

type FCResult = { url: string; title: string; description?: string; markdown?: string };

const cache = new Map<string, { at: number; data: Offer[] }>();
const TTL = 1000 * 60 * 10;

const PRICE_PATTERNS = [
  /(?:R|ZAR)\s?(\d{1,4}(?:[.,]\d{2}))/gi,
  /(?:R|ZAR)\s?(\d{1,4})(?!\d)/gi,
];

function tokensFor(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9.]/g, ""))
    .filter((token) => token.length > 1);
}

function matchesExactItem(result: FCResult, query: string) {
  const tokens = tokensFor(query);
  if (tokens.length === 0) return false;
  const text = `${result.title} ${result.description ?? ""} ${result.markdown ?? ""}`.toLowerCase();
  return tokens.every((token) => text.includes(token));
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

function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

async function searchExactItem(apiKey: string, query: string): Promise<Offer[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `"${query}" grocery price South Africa retailer`,
      limit: 10,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: { web?: FCResult[] } | FCResult[];
  };
  const results: FCResult[] = Array.isArray(json.data) ? json.data : json.data?.web ?? [];

  return results
    .filter((result) => matchesExactItem(result, query))
    .flatMap((result) => {
      const text = `${result.title} ${result.description ?? ""} ${result.markdown ?? ""}`;
      const prices = extractPrices(text);
      if (prices.length === 0) return [];
      const price = prices[0];
      const store = hostnameFor(result.url);
      return [{
        id: `${store}-${result.url}`,
        store,
        storeId: store,
        title: result.title,
        description: result.description ?? "",
        url: result.url,
        price,
        priceText: `R${price.toFixed(2)}`,
        matchedQuery: query,
      }];
    })
    .sort((a, b) => a.price - b.price);
}

export const Route = createFileRoute("/api/groceries")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) return Response.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });

        let body: { query?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const query = (body.query ?? "").toString().trim().slice(0, 120);
        if (!query) return Response.json({ offers: [] });

        const cacheKey = query.toLowerCase();
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) return Response.json({ offers: hit.data, cached: true, exactQuery: query });

        const offers = await searchExactItem(apiKey, query);
        cache.set(cacheKey, { at: Date.now(), data: offers });
        return Response.json({ offers, exactQuery: query });
      },
    },
  },
});
