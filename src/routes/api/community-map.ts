import { createFileRoute } from "@tanstack/react-router";

type GooglePlace = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  rating?: number;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GoogleNearbyResponse = {
  results?: GooglePlace[];
  status?: string;
  error_message?: string;
};

type GooglePlaceDetailsResponse = {
  result?: GooglePlace;
  status?: string;
  error_message?: string;
};

type SerpPlace = {
  place_id?: string;
  data_id?: string;
  data_cid?: string;
  title?: string;
  address?: string;
  website?: string;
  phone?: string;
  hours?: string;
  open_state?: string;
  operating_hours?: Record<string, string> | string;
  rating?: number;
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
};

type SerpMapsResponse = {
  local_results?: SerpPlace[];
  error?: string | { message?: string };
};

type CommunityPlace = {
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
  lat?: number;
  lng?: number;
};

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type NominatimPlace = {
  osm_id?: number;
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
  };
};

const PLACE_SEARCHES = {
  all: {
    category: "Nearby places",
    type: "point_of_interest",
    keyword: "community resources clinics NGOs grocery municipal services",
  },
  clinics: { category: "Clinics", type: "hospital", keyword: "clinic health services" },
  ngos: {
    category: "NGOs",
    type: "point_of_interest",
    keyword: "NGO nonprofit community organisation",
  },
  groceries: {
    category: "Grocery stores",
    type: "grocery_or_supermarket",
    keyword: "grocery supermarket food store",
  },
  municipal: {
    category: "Municipal services",
    type: "local_government_office",
    keyword: "municipal office city services",
  },
} as const;

type PlaceCategory = keyof typeof PLACE_SEARCHES;

const MAP_SEARCHES = [
  { category: "Nearby places", type: "point_of_interest", keyword: "community" },
  { category: "Clinics", type: "hospital", keyword: "clinic" },
  { category: "NGOs", type: "point_of_interest", keyword: "NGO community organisation" },
  { category: "Grocery stores", type: "grocery_or_supermarket", keyword: "grocery supermarket" },
  { category: "Municipal offices", type: "local_government_office", keyword: "municipal office" },
  { category: "Emergency services", type: "police", keyword: "emergency police fire ambulance" },
  {
    category: "Community hotspots",
    type: "point_of_interest",
    keyword: "community centre library market",
  },
] as const;

const cache = new Map<string, { at: number; data: CommunityPlace[]; provider: string }>();
const TTL = 1000 * 60 * 10;

function googleMapsKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY;
}

function cleanKey(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function serpApiKeys() {
  return [
    cleanKey(process.env.SERPAPI_API_KEY),
    cleanKey(process.env.SERP_API_KEY),
    cleanKey(process.env.SERPAPI_KEY),
    cleanKey(process.env.SERPAPI_APIKEY),
    cleanKey(process.env.VITE_SERPAPI_API_KEY),
    cleanKey(process.env.VITE_SERP_API_KEY),
    cleanKey(process.env.SEREAPI_API_KEY),
    cleanKey(process.env.VITE_SEREAPI_API_KEY),
    cleanKey(import.meta.env.SERPAPI_API_KEY),
    cleanKey(import.meta.env.SERP_API_KEY),
    cleanKey(import.meta.env.SERPAPI_KEY),
    cleanKey(import.meta.env.SERPAPI_APIKEY),
    cleanKey(import.meta.env.VITE_SERPAPI_API_KEY),
    cleanKey(import.meta.env.VITE_SERP_API_KEY),
    cleanKey(import.meta.env.SEREAPI_API_KEY),
    cleanKey(import.meta.env.VITE_SEREAPI_API_KEY),
  ].filter((key, index, arr): key is string => Boolean(key) && arr.indexOf(key) === index);
}

function isSerpApiQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /run out of searches|account has run out|insufficient credits|quota/i.test(message);
}

function nearbyUrl(params: Record<string, string | number>) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

function detailsUrl(params: Record<string, string | number>) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

function uniquePlaces(places: CommunityPlace[]) {
  return places.filter(
    (place, index, arr) =>
      arr.findIndex(
        (item) =>
          item.id === place.id ||
          `${item.name}-${item.address}`.toLowerCase() ===
            `${place.name}-${place.address}`.toLowerCase(),
      ) === index,
  );
}

function distanceMeters(fromLat: number, fromLng: number, toLat?: number, toLng?: number) {
  if (typeof toLat !== "number" || typeof toLng !== "number") return undefined;
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function withDistances(places: CommunityPlace[], lat: number, lng: number) {
  return places
    .map((place) => ({
      ...place,
      distanceMeters: distanceMeters(lat, lng, place.lat, place.lng),
    }))
    .sort(
      (a, b) =>
        (a.distanceMeters ?? Number.POSITIVE_INFINITY) -
        (b.distanceMeters ?? Number.POSITIVE_INFINITY),
    );
}

function normalizeCategory(value: string | null): PlaceCategory {
  if (value === "clinics" || value === "ngos" || value === "groceries" || value === "municipal")
    return value;
  return "all";
}

function hoursText(hours: SerpPlace["operating_hours"], fallback?: string) {
  if (typeof hours === "string") return hours;
  if (hours && typeof hours === "object") {
    const today = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "Africa/Johannesburg",
    })
      .format(new Date())
      .toLowerCase();
    return (
      hours[today] ??
      Object.entries(hours)
        .slice(0, 2)
        .map(([day, value]) => `${day}: ${value}`)
        .join("; ")
    );
  }
  return fallback ?? "Hours not listed";
}

function queryFor(category: PlaceCategory, query: string) {
  const base = PLACE_SEARCHES[category].keyword;
  const cleaned = query.trim().slice(0, 120);
  return cleaned ? `${cleaned} ${base}` : base;
}

function serpMapsUrl(params: {
  key: string;
  query: string;
  lat: number;
  lng: number;
  zoom?: number;
}) {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("api_key", params.key);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", params.query);
  url.searchParams.set("ll", `@${params.lat},${params.lng},${params.zoom ?? 14}z`);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "za");
  return url;
}

function apiErrorMessage(error: SerpMapsResponse["error"], fallback: string) {
  if (typeof error === "string") return error;
  return error?.message ?? fallback;
}

async function fetchSerpMaps(url: URL) {
  const response = await fetch(url);
  const text = await response.text();
  let json: SerpMapsResponse;
  try {
    json = JSON.parse(text) as SerpMapsResponse;
  } catch {
    throw new Error(text || "SerpAPI returned an invalid response");
  }
  if (!response.ok || json.error)
    throw new Error(apiErrorMessage(json.error, "SerpAPI Google Maps request failed"));
  return json;
}

async function fetchNearbyPlaces(key: string, lat: number, lng: number) {
  const groups = await Promise.allSettled(
    MAP_SEARCHES.map(async (search) => {
      const response = await fetch(
        nearbyUrl({
          key,
          location: `${lat},${lng}`,
          radius: 5000,
          type: search.type,
          keyword: search.keyword,
        }),
      );
      const json = (await response.json()) as GoogleNearbyResponse;
      if (!response.ok || (json.status && !["OK", "ZERO_RESULTS"].includes(json.status))) {
        throw new Error(json.error_message || json.status || "Google Places request failed");
      }

      return (json.results ?? [])
        .slice(0, 6)
        .map((place): CommunityPlace | null => {
          const placeLat = place.geometry?.location?.lat;
          const placeLng = place.geometry?.location?.lng;
          if (!place.name || typeof placeLat !== "number" || typeof placeLng !== "number")
            return null;

          return {
            id: place.place_id ?? `${place.name}-${place.vicinity ?? search.category}`,
            name: place.name,
            category: search.category,
            address: place.vicinity ?? search.category,
            rating: typeof place.rating === "number" ? place.rating : undefined,
            lat: placeLat,
            lng: placeLng,
          };
        })
        .filter((place): place is CommunityPlace => Boolean(place));
    }),
  );

  return withDistances(
    uniquePlaces(groups.flatMap((group) => (group.status === "fulfilled" ? group.value : []))),
    lat,
    lng,
  ).slice(0, 36);
}

async function fetchGooglePlaceDetails(key: string, placeId: string) {
  const response = await fetch(
    detailsUrl({
      key,
      place_id: placeId,
      fields: "formatted_address,formatted_phone_number,opening_hours,website",
    }),
  );
  const json = (await response.json()) as GooglePlaceDetailsResponse;
  if (!response.ok || (json.status && !["OK", "ZERO_RESULTS"].includes(json.status))) {
    throw new Error(json.error_message || json.status || "Google Places details request failed");
  }
  return json.result;
}

async function searchGooglePlaces(
  key: string,
  category: PlaceCategory,
  query: string,
  lat: number,
  lng: number,
) {
  const search = PLACE_SEARCHES[category];
  const response = await fetch(
    nearbyUrl({
      key,
      location: `${lat},${lng}`,
      radius: 5000,
      type: search.type,
      keyword: queryFor(category, query),
    }),
  );
  const json = (await response.json()) as GoogleNearbyResponse;
  if (!response.ok || (json.status && !["OK", "ZERO_RESULTS"].includes(json.status))) {
    throw new Error(json.error_message || json.status || "Google Places request failed");
  }

  const places = await Promise.all(
    (json.results ?? []).slice(0, 8).map(async (place): Promise<CommunityPlace | null> => {
      const placeLat = place.geometry?.location?.lat;
      const placeLng = place.geometry?.location?.lng;
      if (!place.name || typeof placeLat !== "number" || typeof placeLng !== "number") return null;

      const details = place.place_id
        ? await fetchGooglePlaceDetails(key, place.place_id).catch(() => undefined)
        : undefined;
      const openNow = details?.opening_hours?.open_now;

      return {
        id: place.place_id ?? `${place.name}-${place.vicinity ?? search.category}`,
        name: place.name,
        category: search.category,
        address: details?.formatted_address ?? place.vicinity ?? "Address not listed",
        website: details?.website,
        phone: details?.formatted_phone_number ?? "Phone not listed",
        hours: details?.opening_hours?.weekday_text?.join("; ") ?? "Hours not listed",
        openStatus:
          typeof openNow === "boolean"
            ? openNow
              ? "Open now"
              : "Closed now"
            : "Availability not listed",
        rating: typeof place.rating === "number" ? place.rating : undefined,
        lat: placeLat,
        lng: placeLng,
      };
    }),
  );

  return withDistances(
    uniquePlaces(places.filter((place): place is CommunityPlace => Boolean(place))),
    lat,
    lng,
  );
}

function overpassFilter(category: PlaceCategory) {
  if (category === "clinics") return '["amenity"~"clinic|doctors|hospital|pharmacy"]';
  if (category === "ngos")
    return '["amenity"~"social_facility|community_centre|place_of_worship|shelter"]';
  if (category === "groceries")
    return '["shop"~"supermarket|convenience|greengrocer|butcher|bakery"]';
  if (category === "municipal")
    return '["office"~"government|administrative"]["name"],["amenity"~"townhall|courthouse|police|fire_station"]';
  return '["amenity"~"clinic|doctors|hospital|pharmacy|social_facility|community_centre|shelter|townhall|courthouse|police|fire_station"],["shop"~"supermarket|convenience|greengrocer|butcher|bakery"],["office"~"government|administrative"]';
}

function overpassQuery(category: PlaceCategory, lat: number, lng: number) {
  const filters = overpassFilter(category)
    .split(",")
    .map((filter) => filter.trim())
    .filter(Boolean);
  const radius = 5000;
  const blocks = filters.flatMap((filter) => [
    `node${filter}(around:${radius},${lat},${lng});`,
    `way${filter}(around:${radius},${lat},${lng});`,
    `relation${filter}(around:${radius},${lat},${lng});`,
  ]);

  return `
    [out:json][timeout:20];
    (
      ${blocks.join("\n")}
    );
    out center 20;
  `;
}

function addressFromTags(tags: Record<string, string>) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  return [street, tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(", ");
}

async function searchOpenStreetMapPlaces(category: PlaceCategory, lat: number, lng: number) {
  const overpassPlaces = await searchOverpassPlaces(category, lat, lng).catch(() => []);
  if (overpassPlaces.length > 0) return overpassPlaces;
  return searchNominatimPlaces(category, lat, lng);
}

async function searchOverpassPlaces(category: PlaceCategory, lat: number, lng: number) {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: overpassQuery(category, lat, lng) }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error("OpenStreetMap resource search failed");
  let json: OverpassResponse;
  try {
    json = JSON.parse(text) as OverpassResponse;
  } catch {
    throw new Error("OpenStreetMap returned an invalid resource response");
  }

  return withDistances(
    uniquePlaces(
      (json.elements ?? [])
        .map((element): CommunityPlace | null => {
          const tags = element.tags ?? {};
          const name = tags.name ?? tags.operator;
          const placeLat = element.lat ?? element.center?.lat;
          const placeLng = element.lon ?? element.center?.lon;
          if (!name || typeof placeLat !== "number" || typeof placeLng !== "number") return null;

          return {
            id: `osm-${element.id}`,
            name,
            category: PLACE_SEARCHES[category].category,
            address: addressFromTags(tags) || tags["addr:full"] || "Address not listed",
            website: tags.website ?? tags["contact:website"],
            phone: tags.phone ?? tags["contact:phone"] ?? "Phone not listed",
            hours: tags.opening_hours ?? "Hours not listed",
            openStatus: tags.opening_hours ? "Hours available" : "Availability not listed",
            lat: placeLat,
            lng: placeLng,
          };
        })
        .filter((place): place is CommunityPlace => Boolean(place)),
    ),
    lat,
    lng,
  ).slice(0, 12);
}

function nominatimQuery(category: PlaceCategory) {
  if (category === "clinics") return "clinic OR hospital OR doctor";
  if (category === "ngos") return "community centre OR social facility OR shelter";
  if (category === "groceries") return "supermarket OR grocery";
  if (category === "municipal") return "municipal office OR town hall OR government office";
  return "community resources clinic supermarket municipal office";
}

function nominatimAddress(place: NominatimPlace) {
  const address = place.address;
  if (!address) return place.display_name ?? "Address not listed";
  const street = [address.house_number, address.road].filter(Boolean).join(" ");
  return [street, address.suburb, address.city ?? address.town ?? address.municipality]
    .filter(Boolean)
    .join(", ");
}

async function searchNominatimPlaces(category: PlaceCategory, lat: number, lng: number) {
  const delta = 0.08;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", nominatimQuery(category));
  url.searchParams.set("limit", "12");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("bounded", "1");
  url.searchParams.set("viewbox", `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);

  const response = await fetch(url, {
    headers: { "User-Agent": "CommunityHub availability search" },
  });
  const text = await response.text();
  if (!response.ok) throw new Error("OpenStreetMap place search failed");

  let json: NominatimPlace[];
  try {
    json = JSON.parse(text) as NominatimPlace[];
  } catch {
    throw new Error("OpenStreetMap returned an invalid place response");
  }

  return withDistances(
    uniquePlaces(
      json
        .map((place): CommunityPlace | null => {
          const placeLat = Number(place.lat);
          const placeLng = Number(place.lon);
          const name = place.name ?? place.display_name?.split(",")[0];
          if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return null;
          return {
            id: `osm-${place.osm_id ?? place.place_id ?? `${name}-${placeLat}-${placeLng}`}`,
            name,
            category: PLACE_SEARCHES[category].category,
            address: nominatimAddress(place),
            phone: "Phone not listed",
            hours: "Hours not listed",
            openStatus: "Availability not listed",
            lat: placeLat,
            lng: placeLng,
          };
        })
        .filter((place): place is CommunityPlace => Boolean(place)),
    ),
    lat,
    lng,
  );
}

async function fetchSerpNearbyPlaces(key: string, lat: number, lng: number) {
  const groups = await Promise.allSettled(
    MAP_SEARCHES.map(async (search) => {
      const json = await fetchSerpMaps(serpMapsUrl({ key, query: search.keyword, lat, lng }));

      return (json.local_results ?? [])
        .slice(0, 6)
        .map((place): CommunityPlace | null => {
          const placeLat = place.gps_coordinates?.latitude;
          const placeLng = place.gps_coordinates?.longitude;
          if (!place.title || typeof placeLat !== "number" || typeof placeLng !== "number")
            return null;

          return {
            id:
              place.place_id ??
              place.data_id ??
              place.data_cid ??
              `${place.title}-${place.address ?? search.category}`,
            name: place.title,
            category: search.category,
            address: place.address ?? search.category,
            website: place.website,
            phone: place.phone,
            hours: hoursText(place.operating_hours, place.hours),
            openStatus: place.open_state ?? "Availability not listed",
            rating: typeof place.rating === "number" ? place.rating : undefined,
            lat: placeLat,
            lng: placeLng,
          };
        })
        .filter((place): place is CommunityPlace => Boolean(place));
    }),
  );

  return withDistances(
    uniquePlaces(groups.flatMap((group) => (group.status === "fulfilled" ? group.value : []))),
    lat,
    lng,
  ).slice(0, 36);
}

async function searchSerpPlaces(
  key: string,
  category: PlaceCategory,
  query: string,
  lat: number,
  lng: number,
) {
  const search = PLACE_SEARCHES[category];
  const json = await fetchSerpMaps(
    serpMapsUrl({ key, query: queryFor(category, query), lat, lng }),
  );

  return withDistances(
    uniquePlaces(
      (json.local_results ?? [])
        .slice(0, 12)
        .map((place): CommunityPlace | null => {
          if (!place.title) return null;
          return {
            id:
              place.place_id ??
              place.data_id ??
              place.data_cid ??
              `${place.title}-${place.address ?? search.category}`,
            name: place.title,
            category: search.category,
            address: place.address ?? "Address not listed",
            website: place.website,
            phone: place.phone ?? "Phone not listed",
            hours: hoursText(place.operating_hours, place.hours),
            openStatus: place.open_state ?? "Availability not listed",
            rating: typeof place.rating === "number" ? place.rating : undefined,
            lat: place.gps_coordinates?.latitude,
            lng: place.gps_coordinates?.longitude,
          };
        })
        .filter((place): place is CommunityPlace => Boolean(place)),
    ),
    lat,
    lng,
  );
}

async function searchWithSerpApiKeys(
  keys: string[],
  search: (key: string) => Promise<CommunityPlace[]>,
) {
  let quotaError: Error | null = null;
  for (const key of keys) {
    try {
      return await search(key);
    } catch (error) {
      if (!isSerpApiQuotaError(error)) throw error;
      quotaError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw quotaError ?? new Error("SerpAPI request failed");
}

export const Route = createFileRoute("/api/community-map")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        const category = normalizeCategory(url.searchParams.get("category"));
        const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return Response.json({ error: "Valid lat and lng are required" }, { status: 400 });
        }

        try {
          const wantsTargetedSearch = query || category !== "all";
          const cacheKey = `${category}|${query.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
          const cached = cache.get(cacheKey);
          if (cached && Date.now() - cached.at < TTL) {
            return Response.json({ places: cached.data, provider: cached.provider, cached: true });
          }

          if (wantsTargetedSearch) {
            const serpKeys = serpApiKeys();
            if (serpKeys.length === 0)
              return Response.json({ error: "SERPAPI_API_KEY not configured" }, { status: 500 });

            try {
              const places = await searchWithSerpApiKeys(serpKeys, (key) =>
                searchSerpPlaces(key, category, query, lat, lng),
              );
              cache.set(cacheKey, {
                at: Date.now(),
                data: places,
                provider: "serpapi-google-maps",
              });
              return Response.json({ places, provider: "serpapi-google-maps" });
            } catch (error) {
              if (!isSerpApiQuotaError(error)) throw error;

              const key = googleMapsKey();
              if (!key) {
                const places = await searchOpenStreetMapPlaces(category, lat, lng);
                cache.set(cacheKey, {
                  at: Date.now(),
                  data: places,
                  provider: "openstreetmap-overpass",
                });
                return Response.json({
                  places,
                  provider: "openstreetmap-overpass",
                  warning: "SerpAPI quota exhausted; using OpenStreetMap fallback.",
                });
              }

              const places = await searchGooglePlaces(key, category, query, lat, lng).catch(() =>
                searchOpenStreetMapPlaces(category, lat, lng),
              );
              cache.set(cacheKey, {
                at: Date.now(),
                data: places,
                provider: "fallback-live-places",
              });
              return Response.json({
                places,
                provider: "fallback-live-places",
                warning: "SerpAPI quota exhausted; using another live places provider.",
              });
            }
          }

          const key = googleMapsKey();
          const googlePlaces = key ? await fetchNearbyPlaces(key, lat, lng).catch(() => []) : [];
          if (googlePlaces.length > 0)
            return Response.json({ places: googlePlaces, provider: "google" });

          const serpKeys = serpApiKeys();
          if (serpKeys.length === 0) return Response.json({ places: [], provider: "none" });

          const serpPlaces = await searchWithSerpApiKeys(serpKeys, (key) =>
            fetchSerpNearbyPlaces(key, lat, lng),
          );
          cache.set(cacheKey, {
            at: Date.now(),
            data: serpPlaces,
            provider: "serpapi-google-maps",
          });
          return Response.json({ places: serpPlaces, provider: "serpapi-google-maps" });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Nearby places could not load" },
            { status: 502 },
          );
        }
      },
    },
  },
});
