import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  HeartHandshake,
  Megaphone,
  MapPin,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Siren,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { ResourceCard } from "@/components/ResourceCard";
import { resources, type Resource, type ResourceType } from "@/data/resources";
import { useT } from "@/lib/i18n";

type Filter = "all" | ResourceType;

const examples = ["clinic", "mental health", "free food", "youth support", "power outage"];

function scoreResources(query: string, filter: Filter) {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  return resources
    .filter((resource) => filter === "all" || resource.type === filter)
    .map((resource) => {
      const haystack = `${resource.name} ${resource.description} ${resource.location} ${resource.type} ${resource.tags.join(" ")}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { resource, score };
    })
    .filter(({ score }) => tokens.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.resource.name.localeCompare(b.resource.name))
    .map(({ resource }) => resource);
}

const categoryCards: {
  type: Filter;
  label: string;
  description: string;
  icon: typeof Stethoscope;
  className: string;
}[] = [
  {
    type: "all",
    label: "All resources",
    description: "Clinics, NGOs, alerts, and community support.",
    icon: Search,
    className: "bg-primary/10 text-primary",
  },
  {
    type: "clinic",
    label: "Health care",
    description: "Clinics, counselling, check-ups, and mobile care.",
    icon: Stethoscope,
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    type: "ngo",
    label: "Community help",
    description: "Food, shelter, youth, legal, and family support.",
    icon: HeartHandshake,
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    type: "alert",
    label: "Local alerts",
    description: "Outages, road closures, drives, and public notices.",
    icon: AlertTriangle,
    className: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
  },
];

const nextActions = [
  {
    title: "Share a community update",
    description: "Post local needs, changes, photos, and service updates for your area.",
    to: "/feed",
    icon: Megaphone,
  },
  {
    title: "Emergency contacts",
    description: "Open quick-call numbers for urgent help in South Africa.",
    to: "/emergency",
    icon: Siren,
  },
  {
    title: "Compare grocery prices",
    description: "Find lower prices and build a simple grocery list.",
    to: "/groceries",
    icon: ShoppingBasket,
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Community Compass - Find Local Resources" },
      {
        name: "description",
        content: "Find clinics, NGOs, alerts, emergency contacts, and local support available to your community.",
      },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const { t } = useT();
  const resultsRef = useRef<HTMLElement>(null);
  const shouldScrollToResults = useRef(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Cape Town, South Africa");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [submittedLocation, setSubmittedLocation] = useState("Cape Town, South Africa");
  const [filter, setFilter] = useState<Filter>("all");
  const [remoteResources, setRemoteResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [resourceOrigin, setResourceOrigin] = useState("Cape Town, South Africa");

  const counts = useMemo(
    () => ({
      all: resources.length,
      clinic: resources.filter((resource) => resource.type === "clinic").length,
      ngo: resources.filter((resource) => resource.type === "ngo").length,
      alert: resources.filter((resource) => resource.type === "alert").length,
    }),
    [],
  );

  const localResults = useMemo(() => scoreResources(submittedQuery, filter), [submittedQuery, filter]);
  const results = remoteResources.length > 0 ? remoteResources : localResults;
  const hasSearch = submittedQuery.trim().length > 0 || filter !== "all";
  const featured = results.slice(0, hasSearch ? results.length : 6);

  const submitSearch = (value = query) => {
    shouldScrollToResults.current = true;
    setSubmittedQuery(value.trim());
    setSubmittedLocation(location.trim() || "Cape Town, South Africa");
  };

  const selectFilter = (nextFilter: Filter) => {
    shouldScrollToResults.current = true;
    setFilter(nextFilter);
  };

  const resetSearch = () => {
    setQuery("");
    setSubmittedQuery("");
    setSubmittedLocation("Cape Town, South Africa");
    setLocation("Cape Town, South Africa");
    setFilter("all");
  };

  useEffect(() => {
    if (!shouldScrollToResults.current) return;
    shouldScrollToResults.current = false;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [submittedQuery, filter]);

  useEffect(() => {
    let cancelled = false;
    async function loadResources() {
      setResourcesLoading(true);
      setResourcesError(null);
      try {
        const params = new URLSearchParams({
          query: submittedQuery,
          location: submittedLocation,
          type: filter,
        });
        const response = await fetch(`/api/resources?${params.toString()}`);
        const data = (await response.json().catch(() => ({}))) as {
          results?: Resource[];
          origin?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Live resources could not load");
        if (cancelled) return;
        setRemoteResources(data.results ?? []);
        setResourceOrigin(data.origin ?? submittedLocation);
      } catch (error) {
        if (!cancelled) {
          setRemoteResources([]);
          setResourcesError(error instanceof Error ? error.message : "Live resources could not load");
          setResourceOrigin(submittedLocation);
        }
      } finally {
        if (!cancelled) setResourcesLoading(false);
      }
    }

    void loadResources();
    return () => {
      cancelled = true;
    };
  }, [filter, submittedLocation, submittedQuery]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
        <div
          className="relative overflow-hidden rounded-2xl border border-border bg-slate-950 p-6 text-white shadow-elegant md:p-8"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(8,16,32,0.92), rgba(8,16,32,0.76), rgba(8,16,32,0.36)), url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=80')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/35 to-transparent" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Local help, made easier to find
            </div>
            <h1 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              Find resources available to your community.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
              Community Compass brings clinics, NGOs, public alerts, emergency contacts, and practical support into one clear place, so residents can find help without sorting through noise.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
              className="mt-6 rounded-xl border border-white/20 bg-white/15 p-2 shadow-card backdrop-blur-md"
            >
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)_auto]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search for clinics, food, youth support, outages..."
                    className="h-11 w-full rounded-lg border border-transparent bg-white pl-9 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-primary/40 focus:ring-2 focus:ring-white/80"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Area or city"
                    className="h-11 w-full rounded-lg border border-transparent bg-white pl-9 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-primary/40 focus:ring-2 focus:ring-white/80"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-white/90"
                >
                  <Search className="h-4 w-4" />
                  Find help
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={query === example && submittedQuery === example}
                  onClick={() => {
                    setQuery(example);
                    submitSearch(example);
                  }}
                  className="rounded-full border border-white/15 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/25 disabled:cursor-default disabled:bg-white/30"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">What you can find</h2>
              <p className="mt-1 text-sm text-muted-foreground">Start broad, then narrow down when you know what you need.</p>
            </div>
            <UsersRound className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-5 grid gap-3">
            {categoryCards.map((category) => {
              const Icon = category.icon;
              const active = filter === category.type;
              return (
                <button
                  key={category.type}
                  type="button"
                  disabled={active}
                  onClick={() => selectFilter(category.type)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "cursor-default border-primary/35 bg-primary/10"
                      : "border-border bg-background/55 hover:bg-secondary"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${category.className}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{category.label}</span>
                      <span className="text-xs font-medium text-muted-foreground">{counts[category.type]}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{category.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <InfoTile value="1" label="Search what you need" />
        <InfoTile value="2" label="Choose a trusted local option" />
        <InfoTile value="3" label="Call, visit, or share it with your community" />
      </section>

      <section ref={resultsRef} className="mt-8 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              {hasSearch ? "Matching resources" : "Available resources"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {resourcesLoading
                ? "Finding live resources from OpenStreetMap..."
                : hasSearch
                  ? `${results.length} result${results.length === 1 ? "" : "s"} found near ${resourceOrigin}.`
                  : `Live OpenStreetMap resources near ${resourceOrigin}, with local saved resources as fallback.`}
            </p>
            {resourcesError && (
              <p className="mt-1 text-xs text-muted-foreground">
                Live lookup unavailable: {resourcesError}. Showing saved Community Compass resources.
              </p>
            )}
          </div>
          {hasSearch && (
            <button
              type="button"
              onClick={resetSearch}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              Clear search
            </button>
          )}
        </div>

        {featured.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <h3 className="font-display text-lg font-semibold">No resources found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Try a broader word like health, food, shelter, youth, outage, or clinic.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((resource) => (
              <ResourceCard key={resource.id} r={resource} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-3">
          <h2 className="font-display text-xl font-bold tracking-tight">More community tools</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("resources.pagesSub")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {nextActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.to}
                to={action.to}
                preload="intent"
                className="group rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elegant"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <h3 className="mt-4 font-display font-semibold group-hover:text-primary">{action.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InfoTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary font-display text-sm font-bold text-primary">
        {value}
      </div>
      <div className="text-sm font-medium">{label}</div>
    </div>
  );
}
