import { createFileRoute } from "@tanstack/react-router";

type Cat = "clinic" | "ngo" | "alert";

const queryFor = (cat: Cat | "all", keyword: string, location: string) => {
  const k = keyword.trim();
  const loc = location.trim();
  const base =
    cat === "clinic" ? `community clinics health services` :
    cat === "ngo" ? `NGOs nonprofits community organizations` :
    cat === "alert" ? `municipal alerts utility outage road closure news` :
    `community resources clinics NGOs alerts`;
  return [k, base, loc && `in ${loc}`].filter(Boolean).join(" ");
};

// Simple in-memory cache (per worker) to limit Firecrawl calls
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 1000 * 60 * 10;

export const Route = createFileRoute("/api/search")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
        }

        let body: { keyword?: string; location?: string; category?: Cat | "all" };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const keyword = (body.keyword ?? "").toString().slice(0, 100);
        const location = (body.location ?? "").toString().slice(0, 100);
        const category = (body.category ?? "all") as Cat | "all";
        if (!location && !keyword) {
          return Response.json({ results: [] });
        }

        const cacheKey = `${category}|${keyword.toLowerCase()}|${location.toLowerCase()}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) {
          return Response.json({ results: hit.data, cached: true });
        }

        const cats: Cat[] = category === "all" ? ["clinic", "ngo", "alert"] : [category];

        const results: Array<{
          id: string;
          type: Cat;
          name: string;
          description: string;
          location: string;
          url: string;
        }> = [];

        await Promise.all(
          cats.map(async (cat) => {
            const q = queryFor(cat, keyword, location);
            try {
              const res = await fetch("https://api.firecrawl.dev/v2/search", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: q, limit: 6 }),
              });
              if (!res.ok) return;
              const json = (await res.json()) as {
                data?: { web?: Array<{ url: string; title: string; description?: string }> } |
                  Array<{ url: string; title: string; description?: string }>;
              };
              const arr = Array.isArray(json.data)
                ? json.data
                : json.data?.web ?? [];
              for (const r of arr) {
                results.push({
                  id: `${cat}-${r.url}`,
                  type: cat,
                  name: r.title,
                  description: r.description ?? "",
                  location: location || "—",
                  url: r.url,
                });
              }
            } catch {
              /* ignore */
            }
          })
        );

        cache.set(cacheKey, { at: Date.now(), data: results });
        return Response.json({ results });
      },
    },
  },
});
