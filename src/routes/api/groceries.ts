import { createFileRoute } from "@tanstack/react-router";

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
  operatingHours?: StoreHours;
};

type FCResult = { url: string; title: string; description?: string; markdown?: string };

const cache = new Map<string, { at: number; data: Offer[] }>();
const TTL = 1000 * 60 * 10;

function firecrawlApiKey() {
  return process.env.FIRECRAWL_API_KEY || import.meta.env.FIRECRAWL_API_KEY;
}

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

function extractOperatingHours(text: string, source: string): StoreHours | undefined {
  const current = text.match(/(?:Open|Closed)\s*\|\s*(?:Closes|Opens)\s*at\s*([0-2]?\d:?[0-5]\d)/i);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayLines = days
    .map((day) => {
      const re = new RegExp(`${day}\\s+(?:is\\s+)?(?:[:|-])?\\s*([0-2]?\\d(?::?\\d{2})?\\s*(?:am|pm)?)(?:\\s*[|\\u2013-]\\s*|\\s+to\\s+)([0-2]?\\d(?::?\\d{2})?\\s*(?:am|pm)?)`, "i");
      const match = text.match(re);
      return match ? `${day.slice(0, 3)} ${formatHour(match[1])}-${formatHour(match[2])}` : "";
    })
    .filter(Boolean);

  if (current || dayLines.length > 0) {
    return {
      summary: dayLines.slice(0, 3).join(", ") || `Current status: ${current?.[0]}`,
      today: current ? current[0].replace(/\s+/g, " ") : dayLines[0],
      source,
      ...statusFromCurrentText(current?.[0]),
    };
  }

  return fallbackOperatingHours(source);
}

function formatHour(value: string) {
  const clean = value.trim().replace(/^(\d{1,2})(\d{2})$/, "$1:$2");
  return clean.toUpperCase();
}

function fallbackOperatingHours(source: string): StoreHours | undefined {
  const host = hostnameFor(source);
  if (host.includes("pnp") || host.includes("picknpay")) {
    const status = statusFromSchedule([
      { day: 0, open: "07:00", close: "18:00" },
      { day: 1, open: "07:00", close: "18:30" },
      { day: 2, open: "07:00", close: "18:30" },
      { day: 3, open: "07:00", close: "18:30" },
      { day: 4, open: "07:00", close: "18:30" },
      { day: 5, open: "07:00", close: "18:30" },
      { day: 6, open: "07:00", close: "18:30" },
    ]);
    return {
      summary: "Most areas: Mon-Sat 07:00-18:30, Sun 07:00-18:00",
      today: status.statusLabel,
      source: "https://pnpmerchants.zendesk.com/hc/en-gb/articles/7579275767442-What-are-the-operating-hours",
      ...status,
    };
  }
  if (host.includes("foodloversmarket")) {
    return branchHours(source);
  }
  if (host.includes("woolworths")) {
    return branchHours(source);
  }
  if (host.includes("checkers") || host.includes("shoprite")) {
    return branchHours(source);
  }
  return undefined;
}

function branchHours(source: string): StoreHours {
  return {
    summary: "Trading hours vary by branch and are published on the linked store page.",
    today: "Check exact open/close times on the linked source",
    source,
    status: "unknown",
    statusLabel: "Hours vary by branch",
  };
}

function statusFromCurrentText(text?: string): Pick<StoreHours, "status" | "statusLabel"> {
  if (!text) return { status: "unknown", statusLabel: "Hours found" };
  const clean = text.replace(/\s+/g, " ");
  const closesAt = clean.match(/Closes\s*at\s*([0-2]?\d:?[0-5]\d)/i)?.[1];
  if (/Closed/i.test(clean)) return { status: "closed", statusLabel: clean };
  if (closesAt) {
    const minutes = minutesUntil(closesAt);
    if (minutes >= 0 && minutes <= 60) return { status: "closing-soon", statusLabel: `Closing soon: ${clean}` };
  }
  if (/Open/i.test(clean)) return { status: "open", statusLabel: clean };
  return { status: "unknown", statusLabel: "Hours found" };
}

function statusFromSchedule(schedule: Array<{ day: number; open: string; close: string }>): Pick<StoreHours, "status" | "statusLabel"> {
  const now = new Date();
  const today = schedule.find((item) => item.day === now.getDay());
  if (!today) return { status: "closed", statusLabel: "Closed today" };
  const current = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(today.open);
  const close = toMinutes(today.close);
  if (current < open || current >= close) return { status: "closed", statusLabel: `Closed now. Opens ${today.open}` };
  if (close - current <= 60) return { status: "closing-soon", statusLabel: `Closing soon. Closes ${today.close}` };
  return { status: "open", statusLabel: `Open now. Closes ${today.close}` };
}

function minutesUntil(value: string) {
  const target = toMinutes(value);
  const now = new Date();
  return target - (now.getHours() * 60 + now.getMinutes());
}

function toMinutes(value: string) {
  const clean = value.trim().replace(/^(\d{1,2})(\d{2})$/, "$1:$2");
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return Number.NaN;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridian = match[3]?.toLowerCase();
  if (meridian === "pm" && hours < 12) hours += 12;
  if (meridian === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
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
        operatingHours: extractOperatingHours(text, result.url),
      }];
    })
    .sort((a, b) => a.price - b.price);
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
