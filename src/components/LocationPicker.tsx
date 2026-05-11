import { useEffect, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { detectCapeTownRegion } from "@/lib/community";
import type { UserLocation } from "@/lib/auth";

type LocationHit = {
  label: string;
  lat: number;
  lng: number;
};

export function LocationPicker({
  value,
  onChange,
  onQueryChange,
  label,
  required = false,
}: {
  value?: UserLocation | null;
  onChange: (location: UserLocation | null) => void;
  onQueryChange?: (query: string) => void;
  label: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [hits, setHits] = useState<LocationHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(value?.label ?? "");
    onQueryChange?.(value?.label ?? "");
  }, [value?.label]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || trimmed === value?.label) {
      setHits([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          q: `${trimmed}, Cape Town, South Africa`,
          limit: "5",
          addressdetails: "1",
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
        if (!response.ok) throw new Error("Location search failed.");
        const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        setHits(
          data
            .map((item) => ({ label: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }))
            .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
        );
      } catch (nextError) {
        setHits([]);
        setError(nextError instanceof Error ? nextError.message : "Location search failed.");
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [query, value?.label]);

  const choose = (hit: LocationHit) => {
    const coords = { lat: Number(hit.lat.toFixed(5)), lng: Number(hit.lng.toFixed(5)) };
    onChange({ label: hit.label, coords, region: detectCapeTownRegion(hit.label, coords) });
    setHits([]);
  };

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        };
        const location = {
          label: `${coords.lat}, ${coords.lng}`,
          coords,
          region: detectCapeTownRegion("", coords),
        };
        onChange(location);
        setQuery(location.label);
      },
      () => setError("GPS was blocked or unavailable."),
    );
  };

  const useManual = () => {
    const labelText = query.trim();
    if (labelText.length < 2) return;
    onChange({ label: labelText, region: detectCapeTownRegion(labelText) });
    setHits([]);
  };

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">
        {label}{required ? " *" : ""}
      </label>
      <div className="mt-1.5 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onQueryChange?.(event.target.value);
            }}
            onBlur={useManual}
            placeholder="Search suburb, address, or area"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            required={required}
          />
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-muted"
          aria-label="Use current location"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>
      {value && (
        <div className="mt-2 rounded-lg border border-border bg-secondary/45 px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <MapPin className="h-3.5 w-3.5" /> {value.region}
          </span>
          <span className="ml-2">{value.label}</span>
        </div>
      )}
      {(searching || error || hits.length > 0) && (
        <div className="mt-2 rounded-xl border border-border bg-card p-2 text-xs shadow-card">
          {searching && <div className="px-2 py-1.5 text-muted-foreground">Searching...</div>}
          {error && <div className="px-2 py-1.5 text-destructive">{error}</div>}
          {hits.map((hit) => (
            <button
              key={`${hit.lat}-${hit.lng}-${hit.label}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(hit)}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {hit.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
