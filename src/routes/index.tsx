import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MapPin, ExternalLink, Stethoscope, HeartHandshake, Briefcase, AlertTriangle, Loader2 } from "lucide-react";

type Cat = "clinic" | "ngo" | "job" | "alert";
type Result = { id: string; type: Cat; name: string; description: string; location: string; url: string };

const filters: { key: "all" | Cat; label: string }[] = [
  { key: "all", label: "All" },
  { key: "clinic", label: "Clinics" },
  { key: "ngo", label: "NGOs" },
  { key: "job", label: "Jobs" },
  { key: "alert", label: "Alerts" },
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
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Community Resources</h1>
        <p className="text-muted-foreground mt-1">Live results from across the web — clinics, NGOs, jobs, and municipal alerts.</p>
      </header>

      <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Keyword (e.g. mental health, food bank)"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <div className="relative sm:w-72">
          <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="Location (city or area)"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setType(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              type === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-muted-foreground py-16 inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="h-4 w-4 animate-spin" /> Fetching live results…
        </div>
      ) : !searched ? (
        <div className="text-center text-muted-foreground py-16">
          Enter a location and keyword above to find real community resources.
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
                className="bg-card text-card-foreground rounded-xl border border-border p-4 hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-base leading-snug line-clamp-2">{r.name}</h3>
                {r.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{r.description}</p>}
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
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
