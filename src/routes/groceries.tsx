import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Loader2, ShoppingCart, ExternalLink, Plus, Tag, Store, Clock, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";

type StoreHours = {
  summary: string;
  today?: string;
  source: string;
  status: "open" | "closed" | "closing-soon" | "unknown";
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
  matchedQuery?: string;
  operatingHours?: StoreHours;
};

const GROCERY_SEARCH_STORAGE_KEY = "community-grocery-search";

export const Route = createFileRoute("/groceries")({
  head: () => ({
    meta: [
      { title: "Grocery Price Compare — CommunityHub" },
      { name: "description", content: "Compare grocery prices across South African retailers and build a shareable cart." },
    ],
  }),
  component: GroceriesPage,
});

function GroceriesPage() {
  const { t } = useT();
  const { items, add } = useCart();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [exactQuery, setExactQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(GROCERY_SEARCH_STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved) as { q?: string; exactQuery?: string; offers?: Offer[]; searched?: boolean };
      setQ(data.q ?? "");
      setExactQuery(data.exactQuery ?? "");
      setOffers(data.offers ?? []);
      setSearched(Boolean(data.searched));
    } catch {
      localStorage.removeItem(GROCERY_SEARCH_STORAGE_KEY);
    }
  }, []);

  const saveSearchState = (next: { q: string; exactQuery: string; offers: Offer[]; searched: boolean }) => {
    localStorage.setItem(GROCERY_SEARCH_STORAGE_KEY, JSON.stringify(next));
  };

  const clearSearch = () => {
    setQ("");
    setOffers([]);
    setExactQuery("");
    setSearched(false);
    setError(null);
    localStorage.removeItem(GROCERY_SEARCH_STORAGE_KEY);
  };

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const res = await fetch("/api/groceries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      const nextOffers = data.offers ?? [];
      const nextExactQuery = data.exactQuery ?? q.trim();
      setOffers(nextOffers);
      setExactQuery(nextExactQuery);
      saveSearchState({ q: q.trim(), exactQuery: nextExactQuery, offers: nextOffers, searched: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setOffers([]);
    } finally { setLoading(false); }
  };

  const cheapest = offers[0];

  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-7xl mx-auto">
      <section className="relative overflow-hidden rounded-3xl mb-8 p-8 md:p-10 text-white shadow-elegant" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30 blur-3xl bg-white" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-medium">
              <Tag className="h-3 w-3" /> {t("groc.badge")}
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-3">{t("groc.title")}</h1>
            <p className="text-white/90 mt-2">{t("groc.subtitle")}</p>
          </div>
          <Link to="/cart" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 text-sm font-semibold hover:bg-white/25 transition">
            <ShoppingCart className="h-4 w-4" />
            {t("groc.viewCart")} · {items.reduce((s, i) => s + i.qty, 0)}
          </Link>
        </div>
      </section>

      <form onSubmit={run} className="glass border border-border rounded-2xl p-3 shadow-card flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("groc.placeholder")}
            className="w-full pl-10 pr-3 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl text-primary-foreground text-sm font-semibold hover:opacity-95 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-elegant" style={{ background: "var(--gradient-primary)" }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t("groc.compare")}
        </button>
        {searched && (
          <button type="button" onClick={clearSearch} className="px-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-muted inline-flex items-center justify-center gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        )}
      </form>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="h-5 w-20 bg-muted rounded-full mb-3" />
              <div className="h-4 w-3/4 bg-muted rounded mb-2" />
              <div className="h-3 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : !searched ? (
        <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Tag className="h-5 w-5" />
          </div>
          <p className="text-muted-foreground">{t("groc.empty")}</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          No sourced prices found for "{exactQuery}". Try the exact product name shown on a retailer site.
        </div>
      ) : (
        <>
        <div className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          Showing sourced prices that matched every word in <span className="font-semibold text-foreground">"{exactQuery}"</span>. Prices are extracted from the linked pages.
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((o) => {
            const isCheapest = cheapest && o.id === cheapest.id;
            const statusClass = hoursStatusClass(o.operatingHours?.status);
            return (
              <div key={o.id} className={`group bg-card text-card-foreground rounded-2xl border p-5 hover:shadow-elegant hover:-translate-y-0.5 transition-all flex flex-col ${isCheapest ? "border-success/60" : "border-border hover:border-primary/30"}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground">
                    <Store className="h-3.5 w-3.5" /> {o.store}
                  </span>
                  {isCheapest && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-success/15 text-[color:var(--success)] border border-success/30">
                      {t("groc.bestPrice")}
                    </span>
                  )}
                </div>
                {o.operatingHours && (
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${statusClass}`}>
                      {o.operatingHours.status === "closing-soon" ? "Closing soon" : o.operatingHours.status}
                    </span>
                  </div>
                )}
                <h3 className="font-display font-semibold text-base leading-snug line-clamp-2">{o.title}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight tabular-nums">{o.priceText}</span>
                  <span className="text-xs text-muted-foreground">sourced</span>
                </div>
                {o.operatingHours && (
                  <div className="mt-3 rounded-xl border border-border bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Operating hours
                    </div>
                    <p className="mt-1">{o.operatingHours.statusLabel}</p>
                    <p className="mt-0.5">{o.operatingHours.today ?? o.operatingHours.summary}</p>
                    <p className="mt-0.5 line-clamp-2">{o.operatingHours.summary}</p>
                    <a href={o.operatingHours.source} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                      Verify hours <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {o.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{o.description}</p>}
                <div className="mt-auto pt-4 flex items-center gap-2">
                  <button
                    onClick={() => add({ id: o.id, query: q, store: o.store, title: o.title, price: o.price, priceText: o.priceText, url: o.url })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-primary-foreground text-xs font-semibold shadow-elegant hover:opacity-95"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("groc.addToCart")}
                  </button>
                  <a href={o.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

function hoursStatusClass(status?: StoreHours["status"]) {
  if (status === "open") return "bg-emerald-500 text-white";
  if (status === "closed") return "bg-red-500 text-white";
  if (status === "closing-soon") return "bg-orange-400 text-orange-950";
  return "bg-secondary text-secondary-foreground border border-border";
}
