import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  Briefcase,
  CloudRain,
  Crosshair,
  ExternalLink,
  Flame,
  Gauge,
  HeartHandshake,
  LocateFixed,
  Loader2,
  MapPin,
  MessageCircle,
  Newspaper,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Siren,
  Sparkles,
  Stethoscope,
  Zap,
} from "lucide-react";
import { analyzeIncident } from "@/lib/crisis-intelligence";
import { useT } from "@/lib/i18n";

type Cat = "clinic" | "ngo" | "job" | "alert";
type Result = { id: string; type: Cat; name: string; description: string; location: string; url: string };
type IncidentType = "Crime" | "Infrastructure" | "Medical" | "Weather" | "Scam" | "Fire";
type Severity = "High" | "Medium" | "Low";
type FeedPost = {
  id: string;
  area: string;
  message: string;
  image?: string;
  coords?: { lat: number; lng: number };
  anonymous?: boolean;
  createdAt: string;
};
type DashboardIncident = {
  type: IncidentType;
  severity: Severity;
  source: string;
  area: string;
  summary: string;
  action: string;
  trust: number;
  time: string;
};
type HotspotRow = {
  area: string;
  issue: string;
  level: number;
  icon: typeof AlertTriangle;
  left: number;
  top: number;
};
type NearbyPlace = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance: number;
};

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

const incidentTypeMeta: Record<IncidentType, { icon: typeof AlertTriangle; cls: string }> = {
  Crime: { icon: ShieldAlert, cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  Infrastructure: { icon: Zap, cls: "bg-amber-500/20 text-amber-800 dark:text-amber-200" },
  Medical: { icon: Stethoscope, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  Weather: { icon: CloudRain, cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  Scam: { icon: ShieldCheck, cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  Fire: { icon: Flame, cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
};

const severityMeta: Record<Severity, string> = {
  High: "bg-red-500 text-white",
  Medium: "bg-amber-400 text-amber-950",
  Low: "bg-emerald-500 text-white",
};

const FEED_STORAGE_KEY = "community-feed-posts";

const severityRank: Record<Severity, number> = { High: 3, Medium: 2, Low: 1 };

function relativeTime(value: string) {
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff)) return "recently";
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day ago`;
}

function positionForArea(area: string, coords?: { lat: number; lng: number }) {
  if (coords) {
    return {
      left: 8 + Math.abs(coords.lng % 1) * 84,
      top: 8 + Math.abs(coords.lat % 1) * 76,
    };
  }
  let hash = 0;
  for (const char of area) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return {
    left: 12 + (hash % 76),
    top: 14 + ((hash >> 3) % 70),
  };
}

function positionNear(origin: { lat: number; lng: number }, place: { lat: number; lng: number }) {
  const latDelta = Math.max(-0.025, Math.min(0.025, place.lat - origin.lat));
  const lngDelta = Math.max(-0.025, Math.min(0.025, place.lng - origin.lng));
  return {
    left: 50 + (lngDelta / 0.025) * 42,
    top: 50 - (latDelta / 0.025) * 38,
  };
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function placeType(tags: Record<string, string>) {
  return tags.shop ?? tags.amenity ?? tags.tourism ?? tags.leisure ?? "place";
}

const resourcePages = [
  {
    titleKey: "resources.feed.title",
    descriptionKey: "resources.feed.desc",
    to: "/feed",
    icon: Newspaper,
    cls: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    titleKey: "nav.groceries",
    descriptionKey: "resources.groceries.desc",
    to: "/groceries",
    icon: ShoppingBasket,
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    titleKey: "nav.cart",
    descriptionKey: "resources.cart.desc",
    to: "/cart",
    icon: ShoppingCart,
    cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    titleKey: "nav.availability",
    descriptionKey: "resources.availability.desc",
    to: "/availability",
    icon: Search,
    cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  {
    titleKey: "nav.emergency",
    descriptionKey: "resources.emergency.desc",
    to: "/emergency",
    icon: Siren,
    cls: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  {
    titleKey: "nav.insights",
    descriptionKey: "resources.insights.desc",
    to: "/insights",
    icon: BarChart3,
    cls: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
  },
  {
    titleKey: "nav.assistant",
    descriptionKey: "resources.assistant.desc",
    to: "/chat",
    icon: MessageCircle,
    cls: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Community Crisis Intelligence - CommunityHub" },
      { name: "description", content: "AI-powered community alerts, resources, incident summaries and crisis intelligence." },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [type, setType] = useState<"all" | Cat>("all");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [mapOrigin, setMapOrigin] = useState({ lat: -33.9249, lng: 18.4241 });
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  useEffect(() => {
    const loadFeedPosts = () => {
      try {
        const saved = localStorage.getItem(FEED_STORAGE_KEY);
        setFeedPosts(saved ? JSON.parse(saved) : []);
      } catch {
        setFeedPosts([]);
      }
    };

    loadFeedPosts();
    window.addEventListener("storage", loadFeedPosts);
    window.addEventListener("focus", loadFeedPosts);
    return () => {
      window.removeEventListener("storage", loadFeedPosts);
      window.removeEventListener("focus", loadFeedPosts);
    };
  }, []);

  const intelligenceStats = useMemo(() => {
    const analyses = feedPosts.map((post) => analyzeIncident(post.message, Boolean(post.image)));
    const actionable = analyses.filter((analysis) => analysis.category !== "Community");
    const high = analyses.filter((analysis) => analysis.severity === "High").length;
    const riskScore = analyses.length
      ? Math.min(96, Math.round(analyses.reduce((sum, analysis) => sum + analysis.trust + analysis.panic, 0) / analyses.length / 2 + high * 8))
      : 42;
    const hotspots = new Set(feedPosts.map((post) => post.area.trim().toLowerCase()).filter(Boolean));

    return [
      { label: "Community risk score", value: String(riskScore), detail: high ? `${high} high priority` : "stable", icon: Gauge },
      { label: "Active alerts", value: String(actionable.length), detail: `${high} high priority`, icon: Bell },
      { label: "AI summaries", value: String(analyses.length), detail: "from feed posts", icon: BrainCircuit },
      { label: "Hotspots tracked", value: String(hotspots.size), detail: "community areas", icon: Crosshair },
    ];
  }, [feedPosts]);

  const dashboardIncidents = useMemo<DashboardIncident[]>(() => {
    return feedPosts
      .map((post) => {
        const analysis = analyzeIncident(post.message, Boolean(post.image));
        if (analysis.category === "Community") return null;
        return {
          type: analysis.category as IncidentType,
          severity: analysis.severity,
          source: post.image ? "Community report + image" : "Community report",
          area: post.area || "Unspecified area",
          summary: analysis.summary,
          action: analysis.action,
          trust: analysis.trust,
          time: relativeTime(post.createdAt),
        };
      })
      .filter((incident): incident is DashboardIncident => Boolean(incident))
      .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.trust - a.trust)
      .slice(0, 3);
  }, [feedPosts]);

  const hotspotRows = useMemo<HotspotRow[]>(() => {
    const groups = new Map<string, { count: number; score: number; categories: Record<string, number>; lat: number; lng: number; coordsCount: number }>();
    for (const post of feedPosts) {
      const area = post.area.trim() || "Unspecified area";
      const analysis = analyzeIncident(post.message, Boolean(post.image));
      const current = groups.get(area) ?? { count: 0, score: 0, categories: {}, lat: 0, lng: 0, coordsCount: 0 };
      current.count += 1;
      current.score += analysis.trust + analysis.panic + severityRank[analysis.severity] * 10;
      current.categories[analysis.category] = (current.categories[analysis.category] ?? 0) + 1;
      if (post.coords) {
        current.lat += post.coords.lat;
        current.lng += post.coords.lng;
        current.coordsCount += 1;
      }
      groups.set(area, current);
    }

    return [...groups.entries()]
      .map(([area, group]) => {
        const issue = Object.entries(group.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Community";
        const type = issue === "Community" ? "Infrastructure" : (issue as IncidentType);
        return {
          area,
          issue,
          level: Math.min(100, Math.round(group.score / group.count / 2)),
          icon: incidentTypeMeta[type].icon,
          ...positionForArea(area, group.coordsCount ? { lat: group.lat / group.coordsCount, lng: group.lng / group.coordsCount } : undefined),
        };
      })
      .sort((a, b) => b.level - a.level)
      .slice(0, 5);
  }, [feedPosts]);

  const topIncident = dashboardIncidents[0];

  const loadNearbyPlaces = (useBrowserLocation = true) => {
    setPlacesLoading(true);
    setPlacesError(null);

    const fetchPlaces = async (origin: { lat: number; lng: number }) => {
      setMapOrigin(origin);
      const query = `
        [out:json][timeout:20];
        (
          node(around:1800,${origin.lat},${origin.lng})[amenity];
          node(around:1800,${origin.lat},${origin.lng})[shop];
          node(around:1800,${origin.lat},${origin.lng})[tourism];
          node(around:1800,${origin.lat},${origin.lng})[leisure];
        );
        out center 24;
      `;
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: query,
      });
      if (!response.ok) throw new Error("Nearby places could not load.");
      const data = (await response.json()) as {
        elements?: Array<{ id: number; lat?: number; lon?: number; tags?: Record<string, string> }>;
      };
      const places = (data.elements ?? [])
        .map((item) => {
          const lat = item.lat;
          const lng = item.lon;
          const tags = item.tags ?? {};
          const name = tags.name;
          if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const point = { lat: lat!, lng: lng! };
          return {
            id: String(item.id),
            name,
            type: placeType(tags).replace(/_/g, " "),
            lat: point.lat,
            lng: point.lng,
            distance: distanceKm(origin, point),
          };
        })
        .filter((place): place is NearbyPlace => Boolean(place))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
      setNearbyPlaces(places);
    };

    const fallbackCapeTown = () => {
      fetchPlaces({ lat: -33.9249, lng: 18.4241 })
        .catch((error) => setPlacesError(error instanceof Error ? error.message : "Nearby places could not load."))
        .finally(() => setPlacesLoading(false));
    };

    if (!useBrowserLocation || !navigator.geolocation) {
      fallbackCapeTown();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchPlaces({
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        })
          .catch((error) => setPlacesError(error instanceof Error ? error.message : "Nearby places could not load."))
          .finally(() => setPlacesLoading(false));
      },
      () => fallbackCapeTown(),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  useEffect(() => {
    loadNearbyPlaces(false);
  }, []);

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
      <section
        className="relative min-h-[430px] overflow-hidden rounded-3xl mb-8 p-6 md:p-10 text-white shadow-elegant flex items-end"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(8,16,32,0.88), rgba(8,16,32,0.58), rgba(8,16,32,0.22)), url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="relative grid lg:grid-cols-[1fr_360px] gap-8 w-full items-end">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-medium">
              <Sparkles className="h-3 w-3" /> AI-powered community operations center
            </span>
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight mt-4 leading-[1.02]">
              Community crisis intelligence, resources, and action in one place.
            </h1>
            <p className="text-white/88 mt-4 md:text-lg max-w-2xl">
              Detect urgent reports, summarize incidents, find nearby help, and keep residents informed during outages, fires, crime alerts, clinic shortages, floods, and road closures.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/feed"
                preload="intent"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white/90"
              >
                <Newspaper className="h-4 w-4" /> Report an incident
              </Link>
              <Link
                to="/emergency"
                preload="intent"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white border border-white/25 backdrop-blur-sm hover:bg-white/25"
              >
                <Siren className="h-4 w-4" /> Emergency contacts
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-black/30 backdrop-blur-md p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/65">Live priority</div>
                <div className="font-display text-xl font-semibold mt-1">{topIncident ? `${topIncident.type} report` : "No active reports yet"}</div>
              </div>
              {topIncident && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityMeta[topIncident.severity]}`}>{topIncident.severity}</span>}
            </div>
            <p className="mt-3 text-sm text-white/82">
              {topIncident ? `${topIncident.summary} ${topIncident.action}` : "Reports from the community feed will appear here once residents submit location-based updates."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniMetric value={topIncident ? `${topIncident.trust}%` : "0"} label="trust" />
              <MiniMetric value={topIncident ? topIncident.time : "none"} label="latest" />
              <MiniMetric value={String(hotspotRows.length)} label="areas" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {intelligenceStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <span className="h-10 w-10 grid place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs text-muted-foreground">{stat.detail}</span>
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          );
        })}
      </section>

      <section className="grid xl:grid-cols-[1.35fr_0.65fr] gap-6 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight">AI incident intelligence</h2>
              <p className="text-sm text-muted-foreground mt-1">Classified by urgency, trust level, and recommended action.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-[color:var(--success)]">
              <Activity className="h-3.5 w-3.5" /> Live model-ready flow
            </span>
          </div>
          <div className="space-y-3">
            {dashboardIncidents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background/55 p-6 text-center text-sm text-muted-foreground">
                No feed incidents yet. Ask residents to submit location-based reports from the Community Feed.
              </div>
            ) : dashboardIncidents.map((incident) => {
              const meta = incidentTypeMeta[incident.type];
              const Icon = meta.icon;
              return (
                <article key={`${incident.area}-${incident.time}`} className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`h-10 w-10 shrink-0 grid place-items-center rounded-xl ${meta.cls}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display font-semibold">{incident.type}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityMeta[incident.severity]}`}>
                            {incident.severity}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {incident.area}
                          </span>
                          <span>{incident.time}</span>
                          <span>{incident.trust}% trust</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{incident.source}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{incident.summary}</p>
                  <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                    <span className="font-semibold">Recommended action:</span> {incident.action}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Cape Town nearby map</h2>
              <p className="text-sm text-muted-foreground mt-1">Places around your location and active risk clusters.</p>
            </div>
            <button
              type="button"
              onClick={() => loadNearbyPlaces(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
            >
              <LocateFixed className="h-3.5 w-3.5" /> Near me
            </button>
          </div>
          <div className="relative h-52 overflow-hidden rounded-xl border border-border bg-[linear-gradient(135deg,rgba(15,23,42,.08),rgba(15,23,42,.02))]">
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="absolute left-1/2 top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-8 ring-primary/20" title="Current map center" />
            {nearbyPlaces.map((place) => {
              const point = positionNear(mapOrigin, place);
              return (
                <div
                  key={place.id}
                  className="absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
                  style={{ left: `${point.left}%`, top: `${point.top}%` }}
                  title={`${place.name}: ${place.type}`}
                />
              );
            })}
            {hotspotRows.map((row) => (
              <div
                key={row.area}
                className="absolute h-4 w-4 rounded-full bg-red-500 ring-8 ring-red-500/20"
                style={{ left: `${row.left}%`, top: `${row.top}%`, opacity: Math.max(0.45, row.level / 100) }}
                title={`${row.area}: ${row.issue}`}
              />
            ))}
            {placesLoading && (
              <div className="absolute inset-0 grid place-items-center bg-card/55 text-sm text-muted-foreground">
                Loading nearby Cape Town places...
              </div>
            )}
            {!placesLoading && nearbyPlaces.length === 0 && hotspotRows.length === 0 && (
              <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
                Nearby places load from Cape Town by default. Use Near me to center on your location.
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> map center</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> nearby place</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> hotspot</span>
          </div>
          {placesError && <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{placesError}</div>}
          {nearbyPlaces.length > 0 && (
            <div className="mt-4 space-y-2">
              {nearbyPlaces.slice(0, 5).map((place) => (
                <div key={place.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium">{place.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{place.type} · {place.distance.toFixed(1)} km</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-3">
            {hotspotRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.area}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Icon className="h-4 w-4 text-primary" /> {row.area}
                    </span>
                    <span className="text-xs text-muted-foreground">{row.issue}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${row.level}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight">{t("resources.pages")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("resources.pagesSub")}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {resourcePages.map((page) => {
            const Icon = page.icon;
            return (
              <Link
                key={page.to}
                to={page.to}
                preload="intent"
                className="group bg-card text-card-foreground rounded-2xl border border-border p-5 hover:shadow-elegant hover:-translate-y-0.5 hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`h-11 w-11 grid place-items-center rounded-xl ${page.cls}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="font-display font-semibold text-base mt-4 group-hover:text-primary transition-colors">{t(page.titleKey)}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t(page.descriptionKey)}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-5">
        <div className="mb-3">
          <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight">Search live community resources</h2>
          <p className="text-sm text-muted-foreground mt-1">Use Firecrawl-backed search to find current clinics, NGOs, jobs, and municipal alerts.</p>
        </div>
        <form onSubmit={runSearch} className="glass border border-border rounded-2xl p-3 shadow-card flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search.placeholder")}
              className="w-full pl-10 pr-3 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div className="relative sm:w-72">
            <MapPin className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder={t("location.placeholder")}
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
            {t("search.button")}
          </button>
        </form>
      </section>

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
              {t(f.tk)}
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
          <p className="text-muted-foreground">{t("state.empty")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">{t("state.noResults")}</div>
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

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2">
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
    </div>
  );
}
