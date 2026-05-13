import { createFileRoute } from "@tanstack/react-router";

type GooglePlace = {
  place_id?: string;
  name?: string;
  vicinity?: string;
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

type SerpPlace = {
  place_id?: string;
  data_id?: string;
  title?: string;
  address?: string;
  rating?: number;
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
};

type SerpMapsResponse = {
  local_results?: SerpPlace[];
  error?: string;
};

type CommunityPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating?: number;
  lat: number;
  lng: number;
};

const PLACE_SEARCHES = [
  { category: "Nearby places", type: "point_of_interest", keyword: "community" },
  { category: "Clinics", type: "hospital", keyword: "clinic" },
  { category: "NGOs", type: "point_of_interest", keyword: "NGO community organisation" },
  { category: "Grocery stores", type: "grocery_or_supermarket", keyword: "grocery supermarket" },
  { category: "Municipal offices", type: "local_government_office", keyword: "municipal office" },
  { category: "Emergency services", type: "police", keyword: "emergency police fire ambulance" },
  { category: "Community hotspots", type: "point_of_interest", keyword: "community centre library market" },
] as const;

function googleMapsKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY;
}

function serpApiKey() {
  return (
    process.env.SERPAPI_API_KEY ??
    process.env.SERP_API_KEY ??
    process.env.SERPAPI_KEY ??
    process.env.SERPAPI_APIKEY
  );
}

function nearbyUrl(params: Record<string, string | number>) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

function uniquePlaces(places: CommunityPlace[]) {
  return places.filter(
    (place, index, arr) =>
      arr.findIndex(
        (item) =>
          item.id === place.id ||
          `${item.name}-${item.address}`.toLowerCase() === `${place.name}-${place.address}`.toLowerCase(),
      ) === index,
  );
}

async function fetchNearbyPlaces(key: string, lat: number, lng: number) {
  const groups = await Promise.allSettled(
    PLACE_SEARCHES.map(async (search) => {
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
          if (!place.name || typeof placeLat !== "number" || typeof placeLng !== "number") return null;

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

  return uniquePlaces(groups.flatMap((group) => (group.status === "fulfilled" ? group.value : []))).slice(0, 36);
}

async function fetchSerpNearbyPlaces(key: string, lat: number, lng: number) {
  const groups = await Promise.allSettled(
    PLACE_SEARCHES.map(async (search) => {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("api_key", key);
      url.searchParams.set("engine", "google_maps");
      url.searchParams.set("type", "search");
      url.searchParams.set("q", search.keyword);
      url.searchParams.set("ll", `@${lat},${lng},14z`);
      url.searchParams.set("hl", "en");
      url.searchParams.set("gl", "za");

      const response = await fetch(url);
      const json = (await response.json()) as SerpMapsResponse;
      if (!response.ok || json.error) throw new Error(json.error || "SerpAPI Google Maps request failed");

      return (json.local_results ?? [])
        .slice(0, 6)
        .map((place): CommunityPlace | null => {
          const placeLat = place.gps_coordinates?.latitude;
          const placeLng = place.gps_coordinates?.longitude;
          if (!place.title || typeof placeLat !== "number" || typeof placeLng !== "number") return null;

          return {
            id: place.place_id ?? place.data_id ?? `${place.title}-${place.address ?? search.category}`,
            name: place.title,
            category: search.category,
            address: place.address ?? search.category,
            rating: typeof place.rating === "number" ? place.rating : undefined,
            lat: placeLat,
            lng: placeLng,
          };
        })
        .filter((place): place is CommunityPlace => Boolean(place));
    }),
  );

  return uniquePlaces(groups.flatMap((group) => (group.status === "fulfilled" ? group.value : []))).slice(0, 36);
}

export const Route = createFileRoute("/api/community-map")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return Response.json({ error: "Valid lat and lng are required" }, { status: 400 });
        }

        try {
          const key = googleMapsKey();
          const googlePlaces = key ? await fetchNearbyPlaces(key, lat, lng).catch(() => []) : [];
          if (googlePlaces.length > 0) return Response.json({ places: googlePlaces, provider: "google" });

          const serpKey = serpApiKey();
          if (!serpKey) return Response.json({ places: [], provider: "none" });

          const serpPlaces = await fetchSerpNearbyPlaces(serpKey, lat, lng);
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
