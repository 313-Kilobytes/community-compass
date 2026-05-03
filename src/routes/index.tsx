import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { resources, type ResourceType } from "@/data/resources";
import { ResourceCard } from "@/components/ResourceCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Community Resources — CommunityHub" },
      { name: "description", content: "Search clinics, NGOs, jobs and municipal alerts." },
    ],
  }),
  component: ResourcesPage,
});

const filters: { key: "all" | ResourceType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "clinic", label: "Clinics" },
  { key: "ngo", label: "NGOs" },
  { key: "job", label: "Jobs" },
  { key: "alert", label: "Alerts" },
];

function ResourcesPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | ResourceType>("all");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return resources.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (!term) return true;
      return (
        r.name.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.location.toLowerCase().includes(term) ||
        r.tags.some((t) => t.includes(term))
      );
    });
  }, [q, type]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: resources.length, clinic: 0, ngo: 0, job: 0, alert: 0 };
    resources.forEach((r) => (c[r.type] += 1));
    return c;
  }, []);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Community Resources</h1>
        <p className="text-muted-foreground mt-1">Clinics, NGOs, jobs, and municipal alerts — all in one place.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(["clinic", "ngo", "job", "alert"] as ResourceType[]).map((t) => (
          <div key={t} className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">{t}s</div>
            <div className="text-2xl font-bold mt-1">{counts[t]}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by keyword, location, or tag…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setType(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              type === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">No resources match your search.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((r) => <ResourceCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
