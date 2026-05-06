import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MapPin, ExternalLink, Stethoscope, HeartHandshake, Briefcase, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";

type Cat = "clinic" | "ngo" | "job" | "alert";
type Result = { id: string; type: Cat; name: string; description: string; location: string; url: string };

const filters: { key: "all" | Cat; tk: "filter.all" | "filter.clinic" | "filter.ngo" | "filter.job" | "filter.alert" }[] = [
  { key: "all", tk: "filter.all" },
  { key: "clinic", tk: "filter.clinic" },
  { key: "ngo", tk: "filter.ngo" },
  { key: "job", tk: "filter.job" },
  { key: "alert", tk: "filter.alert" },
];

const typeMeta: Record<Cat, { label: string; icon: typeof MapPin; cls: string }> = {
  clinic: { label: "Clinic", icon: Stethoscope, cls: "bg-primary/10 text-primary" },
  ngo: { label: "NGO", icon: HeartHandshake, cls: "bg-success/15 text-[color:var(--success)]" },
  job: { label: "Job", icon: Briefcase, cls: "bg-accent/20 text-accent-foreground" },
  alert: { label: "Alert", icon: AlertTriangle, cls: "bg-warning/20 text-[color:var(--foreground)]" },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Community Resources — CommunityHub" },
      { name: "description", content: "Search real clinics, NGOs, jobs and municipal alerts in your area." },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [type, setType] = useState<"all" | Cat>("all");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!loc.trim() && !q.trim()) {
      setError("Enter a location or keyword to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: q, location: loc, category: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = type === "all" ? results : results.filter((r) => r.type === type);

  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-7xl mx-auto">
      <section className="relative overflow-hidden rounded-3xl mb-8 p-8 md:p-12 text-white shadow-elegant" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "white" }} />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-medium">
            <Sparkles className="h-3 w-3" /> Live community intelligence
          </span>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
            Find clinics, NGOs, jobs &amp;<br />alerts — anywhere.
          </h1>
          <p className="text-white/85 mt-3 md:text-lg max-w-xl">
            Real-time results scraped from across the web. One search, four resource types, zero noise.
          </p>
        </div>
      </section>

      <form onSubmit={runSearch} className="glass border border-border rounded-2xl p-3 shadow-card flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Keyword (e.g. mental health, food bank)"
            className="w-full pl-10 pr-3 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <div className="relative sm:w-72">
          <MapPin className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="Location (city or area)"
            className="w-full pl-10 pr-3 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-xl text-primary-foreground text-sm font-semibold hover:opacity-95 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-elegant transition-opacity"
          style={{ background: "var(--gradient-primary)" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mb-8">
        {filters.map((f) => {
          const active = type === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setType(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                active
                  ? "text-primary-foreground border-transparent shadow-elegant"
                  : "bg-card border-border hover:bg-secondary text-foreground/80"
              }`}
              style={active ? { background: "var(--gradient-primary)" } : undefined}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="h-5 w-16 bg-muted rounded-full mb-3" />
              <div className="h-4 w-3/4 bg-muted rounded mb-2" />
              <div className="h-3 w-full bg-muted rounded mb-1" />
              <div className="h-3 w-5/6 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : !searched ? (
        <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Search className="h-5 w-5" />
          </div>
          <p className="text-muted-foreground">Enter a location and keyword to find real community resources.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">No results — try a different keyword or location.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const meta = typeMeta[r.type];
            const Icon = meta.icon;
            return (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group bg-card text-card-foreground rounded-2xl border border-border p-5 hover:shadow-elegant hover:-translate-y-0.5 hover:border-primary/30 transition-all block"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
                    <Icon className="h-3.5 w-3.5" /> {meta.label}
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-display font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">{r.name}</h3>
                {r.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{r.description}</p>}
                <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {r.location}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
