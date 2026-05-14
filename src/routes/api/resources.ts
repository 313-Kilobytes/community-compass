import { createFileRoute } from "@tanstack/react-router";
import type { Resource, ResourceType } from "@/data/resources";

type Filter = "all" | ResourceType;

type NominatimHit = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const cache = new Map<string, { at: number; data: Resource[]; origin: string }>();
const TTL = 1000 * 60 * 30;
const DEFAULT_ORIGIN = { lat: -33.9249, lng: 18.4241, label: "Cape Town, South Africa" };

function clean(value?: string) {
  return value?.trim().replace(/\s+/g, " ");
}

function resourceType(tags: Record<string, string>): ResourceType | null {
  const amenity = tags.amenity;
  const healthcare = tags.healthcare;
  const social = tags.social_facility;
  const office = tags.office;

  if (healthcare || ["clinic", "hospital", "doctors", "pharmacy"].includes(amenity ?? "")) return "clinic";
  if (
    social ||
    office === "ngo" ||
    ["social_facility", "community_centre", "library", "food_bank", "shelter"].includes(amenity ?? "")
  ) {
    return "ngo";
  }
  return null;
}

function descriptionFor(tags: Record<string, string>, type: ResourceType) {
  const parts = [
    clean(tags.description),
    clean(tags.healthcare),
    clean(tags.social_facility),
    clean(tags.amenity),
    clean(tags.operator),
  ].filter(Boolean);

  if (parts.length) return parts.join(" · ");
  if (type === "clinic") return "Health service listed in OpenStreetMap.";
  return "Community support resource listed in OpenStreetMap.";
}

function locationFor(tags: Record<string, string>, lat?: number, lng?: number) {
  const address = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ].filter(Boolean).join(" ");
  if (address) return address;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`;
  return "Location listed in OpenStreetMap";
}

function tagsFor(tags: Record<string, string>, type: ResourceType) {
  return [
    type,
    tags.amenity,
    tags.healthcare,
    tags.social_facility,
    tags.operator,
  ]
    .filter((tag): tag is string => Boolean(tag))
    .map((tag) => tag.replace(/_/g, " "))
    .slice(0, 6);
}

function contactFor(tags: Record<string, string>) {
  return clean(tags.phone) ?? clean(tags["contact:phone"]) ?? clean(tags.email) ?? clean(tags["contact:email"]) ?? clean(tags.website);
}

function matchesQuery(resource: Resource, query: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = `${resource.name} ${resource.description} ${resource.location} ${resource.type} ${resource.tags.join(" ")}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

async function geocode(location: string) {
  if (!location.trim()) return DEFAULT_ORIGIN;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", location);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "CommunityCompass/1.0",
      "Accept-Language": "en",
    },
  });
  if (!response.ok) throw new Error("Location lookup failed");
  const hits = (await response.json()) as NominatimHit[];
  const first = hits[0];
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return DEFAULT_ORIGIN;
  return { lat, lng, label: first?.display_name ?? location };
}

function overpassQuery(lat: number, lng: number, filter: Filter) {
  const health = `
    node(around:10000,${lat},${lng})[healthcare];
    way(around:10000,${lat},${lng})[healthcare];
    relation(around:10000,${lat},${lng})[healthcare];
    node(around:10000,${lat},${lng})[amenity~"^(clinic|hospital|doctors|pharmacy)$"];
    way(around:10000,${lat},${lng})[amenity~"^(clinic|hospital|doctors|pharmacy)$"];
    relation(around:10000,${lat},${lng})[amenity~"^(clinic|hospital|doctors|pharmacy)$"];
  `;
  const support = `
    node(around:10000,${lat},${lng})[social_facility];
    way(around:10000,${lat},${lng})[social_facility];
    relation(around:10000,${lat},${lng})[social_facility];
    node(around:10000,${lat},${lng})[office=ngo];
    way(around:10000,${lat},${lng})[office=ngo];
    relation(around:10000,${lat},${lng})[office=ngo];
    node(around:10000,${lat},${lng})[amenity~"^(social_facility|community_centre|library|food_bank|shelter)$"];
    way(around:10000,${lat},${lng})[amenity~"^(social_facility|community_centre|library|food_bank|shelter)$"];
    relation(around:10000,${lat},${lng})[amenity~"^(social_facility|community_centre|library|food_bank|shelter)$"];
  `;
  const body = filter === "clinic" ? health : filter === "ngo" ? support : `${health}\n${support}`;
  return `[out:json][timeout:25];(${body});out center tags 80;`;
}

async function fetchOsmResources(lat: number, lng: number, filter: Filter, query: string) {
  if (filter === "alert") return [];
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": "CommunityCompass/1.0",
    },
    body: overpassQuery(lat, lng, filter),
  });
  if (!response.ok) throw new Error("OpenStreetMap resource lookup failed");
  const data = (await response.json()) as { elements?: OverpassElement[] };

  const resources = (data.elements ?? [])
    .map((element): Resource | null => {
      const tags = element.tags ?? {};
      const name = clean(tags.name);
      const type = resourceType(tags);
      if (!name || !type) return null;
      const pointLat = element.lat ?? element.center?.lat;
      const pointLng = element.lon ?? element.center?.lon;
      return {
        id: `osm-${element.type}-${element.id}`,
        type,
        name,
        description: descriptionFor(tags, type),
        location: locationFor(tags, pointLat, pointLng),
        contact: contactFor(tags),
        tags: tagsFor(tags, type),
      };
    })
    .filter((resource): resource is Resource => Boolean(resource))
    .filter((resource) => filter === "all" || resource.type === filter)
    .filter((resource) => matchesQuery(resource, query));

  return resources.filter(
    (resource, index, arr) =>
      arr.findIndex((item) => `${item.name}-${item.location}`.toLowerCase() === `${resource.name}-${resource.location}`.toLowerCase()) === index,
  ).slice(0, 30);
}

export const Route = createFileRoute("/api/resources")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("query") ?? "").slice(0, 120);
        const location = (url.searchParams.get("location") ?? "").slice(0, 140);
        const filter = (url.searchParams.get("type") ?? "all") as Filter;
        const safeFilter: Filter = ["all", "clinic", "ngo", "alert"].includes(filter) ? filter : "all";
        const cacheKey = `${safeFilter}|${query.toLowerCase()}|${location.toLowerCase()}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) {
          return Response.json({ results: hit.data, provider: "openstreetmap", origin: hit.origin, cached: true });
        }

        try {
          const origin = await geocode(location);
          const results = await fetchOsmResources(origin.lat, origin.lng, safeFilter, query);
          cache.set(cacheKey, { at: Date.now(), data: results, origin: origin.label });
          return Response.json({ results, provider: "openstreetmap", origin: origin.label });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Resource lookup failed", results: [] },
            { status: 502 },
          );
        }
      },
    },
  },
});
