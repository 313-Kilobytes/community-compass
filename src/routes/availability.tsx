import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  HandHeart,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShoppingBasket,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/availability")({
  head: () => ({
    meta: [
      { title: "Resource Availability - CommunityHub" },
      {
        name: "description",
        content: "Check real-time availability of community resources near you.",
      },
    ],
  }),
  component: AvailabilityPage,
});

type Category = "all" | "clinics" | "ngos" | "groceries" | "municipal";

type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  website?: string;
  phone?: string;
  hours?: string;
  openStatus?: string;
  rating?: number;
  distanceMeters?: number;
};

type SearchResponse = {
  places?: Place[];
  provider?: string;
  cached?: boolean;
  error?: string;
};

type LocationState = {
  lat: number;
  lng: number;
  label: string;
  precise: boolean;
};

const CAPE_TOWN: LocationState = {
  lat: -33.9249,
  lng: 18.4241,
  label: "Cape Town",
  precise: false,
};

const CACHE_TTL = 1000 * 60 * 10;
const CACHE_PREFIX = "community-availability-v2";
const DEFAULT_SERPAPI_QUERY = "community resources near me";

const categories: Array<{
  key: Category;
  label: string;
  query: string;
  icon: LucideIcon;
}> = [
  { key: "clinics", label: "Clinics", query: "clinic near me", icon: Stethoscope },
  { key: "ngos", label: "NGOs", query: "NGO community support near me", icon: HandHeart },
  {
    key: "groceries",
    label: "Grocery Stores",
    query: "grocery store near me",
    icon: ShoppingBasket,
  },
  {
    key: "municipal",
    label: "Municipal Services",
    query: "municipal services near me",
    icon: Landmark,
  },
];

const memoryCache = new Map<string, { at: number; data: Place[]; provider?: string }>();

function roundedLocation(location: LocationState) {
  return `${location.lat.toFixed(3)},${location.lng.toFixed(3)}`;
}

function cacheKey(category: Category, query: string, location: LocationState) {
  return `${CACHE_PREFIX}|${category}|${query.toLowerCase().trim()}|${roundedLocation(location)}`;
}

function readCached(key: string) {
  const memoryHit = memoryCache.get(key);
  if (memoryHit && Date.now() - memoryHit.at < CACHE_TTL) return memoryHit;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { at: number; data: Place[]; provider?: string };
    if (Date.now() - parsed.at > CACHE_TTL) return null;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCached(key: string, data: Place[], provider?: string) {
  const value = { at: Date.now(), data, provider };
  memoryCache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Browser storage may be unavailable in private sessions. */
  }
}

function statusClass(status?: string) {
  const text = status?.toLowerCase() ?? "";
  if (text.includes("open")) return "bg-success/15 text-[color:var(--success)] border-success/20";
  if (text.includes("closed")) return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-secondary text-secondary-foreground border-border";
}

function formatDistance(meters?: number) {
  if (typeof meters !== "number" || !Number.isFinite(meters)) return "Distance unavailable";
  if (meters < 1000) return `${meters.toLocaleString()} m away`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km away`;
}

function AvailabilityPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [location, setLocation] = useState<LocationState>(CAPE_TOWN);
  const [places, setPlaces] = useState<Place[]>([]);
  const [provider, setProvider] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("Detecting your location...");

  const selectedCategory = useMemo(
    () => categories.find((category) => category.key === activeCategory),
    [activeCategory],
  );

  const runSearch = useCallback(
    async (nextCategory: Category, nextQuery: string, nextLocation: LocationState) => {
      const searchTerm = nextQuery.trim();
      if (!searchTerm && nextCategory === "all")
        setSummary("Loading nearby community resources...");
      const key = cacheKey(nextCategory, searchTerm, nextLocation);
      const cached = readCached(key);
      if (cached) {
        setPlaces(cached.data);
        setProvider(cached.provider);
        setSummary(
          `${cached.data.length} nearby result${cached.data.length === 1 ? "" : "s"} from cache`,
        );
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          lat: String(nextLocation.lat),
          lng: String(nextLocation.lng),
          category: nextCategory,
        });
        if (searchTerm) params.set("q", searchTerm);

        const response = await fetch(`/api/community-map?${params.toString()}`);
        const json = (await response.json()) as SearchResponse;
        if (!response.ok) throw new Error(json.error ?? "Nearby resources could not load.");

        const nextPlaces = json.places ?? [];
        writeCached(key, nextPlaces, json.provider);
        setPlaces(nextPlaces);
        setProvider(json.provider);
        setSummary(`${nextPlaces.length} nearby result${nextPlaces.length === 1 ? "" : "s"} found`);
      } catch (searchError) {
        setError(
          searchError instanceof Error ? searchError.message : "Nearby resources could not load.",
        );
        setPlaces([]);
        setSummary("Search unavailable");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setSummary("Using Cape Town as your search area.");
      void runSearch("all", DEFAULT_SERPAPI_QUERY, CAPE_TOWN);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Your area",
          precise: true,
        };
        setLocation(nextLocation);
        setLocating(false);
        void runSearch("all", DEFAULT_SERPAPI_QUERY, nextLocation);
      },
      () => {
        setLocating(false);
        setSummary("Location permission was not granted. Using Cape Town.");
        void runSearch("all", DEFAULT_SERPAPI_QUERY, CAPE_TOWN);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 1000 * 60 * 5 },
    );
  }, [runSearch]);

  const chooseCategory = (category: (typeof categories)[number]) => {
    setActiveCategory(category.key);
    setQuery(category.query);
    void runSearch(category.key, category.query, location);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    setActiveCategory("all");
    void runSearch("all", term || DEFAULT_SERPAPI_QUERY, location);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Resource Availability</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Search real nearby clinics, NGOs, grocery stores, and municipal services using your
            location.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {locating
            ? "Detecting location"
            : location.precise
              ? "Near you"
              : `Area: ${location.label}`}
        </div>
      </div>

      <form
        onSubmit={submitSearch}
        className="mt-6 flex flex-col gap-2 rounded-lg border border-border bg-card p-2 shadow-card sm:flex-row"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search food banks, shelters, clinics, grants, water faults..."
            className="h-11 w-full rounded-md border border-transparent bg-background pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
        <Button type="submit" className="h-11 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </form>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const Icon = category.icon;
          const active = activeCategory === category.key;
          return (
            <Button
              key={category.key}
              type="button"
              variant={active ? "default" : "outline"}
              className="h-12 justify-start rounded-lg"
              onClick={() => chooseCategory(category)}
            >
              <Icon className="h-4 w-4" />
              {category.label}
            </Button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">
            {selectedCategory?.label ??
              (query.trim() ? `Results for "${query.trim()}"` : "Nearby resources")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{summary}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          {provider
            ? `Source: ${provider}${summary.includes("cache") ? " cache" : ""}`
            : "Waiting for results"}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-5">
        {loading && places.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-48 animate-pulse rounded-lg border border-border bg-card"
              />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Search a community resource or choose a category to find nearby places.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceCard({ place }: { place: Place }) {
  const cardClass =
    "flex min-h-48 flex-col rounded-lg border border-border bg-card p-4 shadow-card transition hover:border-primary/40 hover:shadow-elegant";
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-primary">{place.category}</div>
          <h2 className="mt-1 line-clamp-2 text-base font-semibold">{place.name}</h2>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
            statusClass(place.openStatus),
          )}
        >
          {place.openStatus ?? "Status unavailable"}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <InfoRow icon={MapPin} value={formatDistance(place.distanceMeters)} />
        <InfoRow icon={MapPin} value={place.address || "Address not listed"} />
        <InfoRow icon={Phone} value={place.phone || "Phone not listed"} />
        <InfoRow icon={Clock} value={place.hours || "Hours not listed"} />
      </div>

      <div className="mt-auto pt-4" />
    </>
  );

  if (place.website) {
    return (
      <a
        className={cn(cardClass, "focus:outline-none focus:ring-2 focus:ring-ring")}
        href={place.website}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open website for ${place.name}`}
      >
        {content}
      </a>
    );
  }

  return <article className={cn(cardClass, "hover:shadow-card")}>{content}</article>;
}

function InfoRow({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}
