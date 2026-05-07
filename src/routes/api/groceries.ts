import { createFileRoute } from "@tanstack/react-router";

const STORES = [
  { id: "checkers", name: "Checkers", site: "checkers.co.za" },
  { id: "pnp", name: "Pick n Pay", site: "pnp.co.za" },
  { id: "shoprite", name: "Shoprite", site: "shoprite.co.za" },
  { id: "woolworths", name: "Woolworths", site: "woolworths.co.za" },
  { id: "makro", name: "Makro", site: "makro.co.za" },
];

type Offer = {
  id: string;
  store: string;
  storeId: string;
  title: string;
  price: number | null;
  priceText: string | null;
  url: string;
  description: string;
};

const cache = new Map<string, { at: number; data: Offer[] }>();
const TTL = 1000 * 60 * 15;

// Match prices like "R 24.99", "R24,99", "ZAR 199.00"
const PRICE_PATTERNS = [
  /(?:R|ZAR)\s?(\d{1,4}(?:[.,]\d{2}))/gi,
  /(?:R|ZAR)\s?(\d{1,4})(?!\d)/gi,
];

function extractPrices(text: string): number[] {
  if (!text) return [];
  const found: number[] = [];
  for (const re of PRICE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseFloat(m[1].replace(",", "."));
      if (isFinite(n) && n >= 1 && n <= 9999) found.push(n);
    }
  }
  return found;
}

function pickBestPrice(text: string): { price: number | null; priceText: string | null } {
  const prices = extractPrices(text);
  if (prices.length === 0) return { price: null, priceText: null };
  // Prefer the lowest plausible price (often current/sale price appears first or smallest)
  const min = Math.min(...prices);
  return { price: min, priceText: `R${min.toFixed(2)}` };
}

type FCResult = { url: string; title: string; description?: string; markdown?: string };

async function searchStore(apiKey: string, query: string, store: typeof STORES[number]): Promise<Offer[]> {
  const q = `${query} site:${store.site}`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: q,
        limit: 2,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { web?: FCResult[] } | FCResult[];
    };
    const arr: FCResult[] = Array.isArray(json.data) ? json.data : json.data?.web ?? [];
    return arr.map((r) => {
      const haystack = `${r.title} ${r.description ?? ""} ${r.markdown ?? ""}`;
      const { price, priceText } = pickBestPrice(haystack);
      return {
        id: `${store.id}-${r.url}`,
        store: store.name,
        storeId: store.id,
        title: r.title,
        description: r.description ?? "",
        url: r.url,
        price,
        priceText,
      };
    });
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/groceries")({
  // @ts-expect-error - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) return Response.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });

        let body: { query?: string };
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

        const query = (body.query ?? "").toString().trim().slice(0, 100);
        if (!query) return Response.json({ offers: [] });

        const cacheKey = query.toLowerCase();
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) return Response.json({ offers: hit.data, cached: true });

        const all = (await Promise.all(STORES.map((s) => searchStore(apiKey, query, s)))).flat();
        // Prefer offers with a price; sort cheapest first within
        all.sort((a, b) => {
          if (a.price == null && b.price == null) return 0;
          if (a.price == null) return 1;
          if (b.price == null) return -1;
          return a.price - b.price;
        });
        cache.set(cacheKey, { at: Date.now(), data: all });
        return Response.json({ offers: all });
      },
    },
  },
});
