import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { resources } from "@/data/resources";
import { ResourceCard } from "@/components/ResourceCard";
import { Search, Siren, Stethoscope, UsersRound } from "lucide-react";

export const Route = createFileRoute("/availability")({
  head: () => ({
    meta: [
      { title: "Resource Availability — CommunityHub" },
      { name: "description", content: "Check availability of community resources near you." },
    ],
  }),
  component: AvailabilityPage,
});

const examples = [
  "Clinic near me",
  "NGOs for youth support",
  "Power outage alerts",
  "Mental health",
  "Free food",
];

// Tiny in-memory cache to avoid recomputing for repeated queries
const cache = new Map<string, ReturnType<typeof scoreResources>>();

function scoreResources(query: string) {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return resources
    .map((r) => {
      const hay = `${r.name} ${r.description} ${r.location} ${r.type} ${r.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score += 1;
      // Type intent boost
      if (q.includes("clinic") && r.type === "clinic") score += 2;
      if (q.includes("ngo") && r.type === "ngo") score += 2;
      if ((q.includes("alert") || q.includes("outage")) && r.type === "alert") score += 2;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
}

function AvailabilityPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("all");

  const results = useMemo(() => {
    if (submitted === "all") return resources;
    if (cache.has(submitted)) return cache.get(submitted)!;
    const r = scoreResources(submitted);
    cache.set(submitted, r);
    return r;
  }, [submitted]);

  const counts = useMemo(
    () => ({
      clinics: resources.filter((resource) => resource.type === "clinic").length,
      ngos: resources.filter((resource) => resource.type === "ngo").length,
      alerts: resources.filter((resource) => resource.type === "alert").length,
    }),
    [],
  );

  const heading = submitted === "all" ? "Available now" : `Results for "${submitted}"`;
  const helper = submitted === "all"
    ? "Showing all cached clinics, NGOs, and community alerts."
    : `${results.length} matching resource${results.length === 1 ? "" : "s"} found.`;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Resource Availability</h1>
      <p className="text-muted-foreground mt-1">Browse available community resources immediately, or filter with plain language.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile icon={Stethoscope} label="Clinics" value={counts.clinics} />
        <SummaryTile icon={UsersRound} label="NGOs" value={counts.ngos} />
        <SummaryTile icon={Siren} label="Alerts" value={counts.alerts} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim() || "all"); }}
        className="mt-6 flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. clinic near me"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <button className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          Check
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => { setQ(""); setSubmitted("all"); }}
          className="text-xs px-2.5 py-1 rounded-full bg-primary text-primary-foreground hover:opacity-90"
        >
          All resources
        </button>
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => { setQ(ex); setSubmitted(ex); }}
            className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-muted"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="text-sm text-muted-foreground">{submitted === "all" ? "Resource directory" : "Search"}</div>
          <div className="font-semibold">{heading}</div>
          <div className="mt-2 text-sm">
            {submitted === "all" ? (
              helper
            ) : (
              <>
                <span className="font-bold text-primary">{results.length}</span> matching resource{results.length === 1 ? "" : "s"} found.
              </>
            )}
          </div>
        </div>
        {results.length === 0 ? (
          <p className="text-muted-foreground">No matches. Try a broader keyword like "health" or "youth".</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {results.map((r) => <ResourceCard key={r.id} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof Stethoscope; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
