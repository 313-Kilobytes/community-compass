import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";

type MapPoint = { lat: number; lng: number };

type NearbyPlace = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance: number;
};

type HotspotRow = {
  area: string;
  issue: string;
  level: number;
  left: number;
  top: number;
  coords?: MapPoint;
};

type LeafletModules = {
  MapContainer: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  TileLayer: React.ComponentType<any>;
  useMap: () => { flyTo: (center: [number, number], zoom?: number, options?: { duration?: number }) => void };
  divIcon: (options: { className?: string; html?: string; iconSize?: [number, number]; iconAnchor?: [number, number] }) => unknown;
};

type NearbyLeafletMapProps = {
  origin: MapPoint;
  nearbyPlaces: NearbyPlace[];
  hotspotRows: HotspotRow[];
  placesLoading: boolean;
};

export function NearbyLeafletMap({ origin, nearbyPlaces, hotspotRows, placesLoading }: NearbyLeafletMapProps) {
  const [leaflet, setLeaflet] = useState<LeafletModules | null>(null);

  useEffect(() => {
    let mounted = true;

    void Promise.all([import("react-leaflet"), import("leaflet")]).then(([reactLeaflet, leafletModule]) => {
      if (!mounted) return;
      setLeaflet({
        MapContainer: reactLeaflet.MapContainer,
        Marker: reactLeaflet.Marker,
        Popup: reactLeaflet.Popup,
        TileLayer: reactLeaflet.TileLayer,
        useMap: reactLeaflet.useMap,
        divIcon: leafletModule.divIcon,
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!leaflet) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-secondary/50 px-6 text-center text-sm text-muted-foreground">
        Loading map...
      </div>
    );
  }

  return (
    <LeafletMapSurface
      leaflet={leaflet}
      origin={origin}
      nearbyPlaces={nearbyPlaces}
      hotspotRows={hotspotRows}
      placesLoading={placesLoading}
    />
  );
}

function LeafletMapSurface({ leaflet, origin, nearbyPlaces, hotspotRows, placesLoading }: NearbyLeafletMapProps & { leaflet: LeafletModules }) {
  const { MapContainer, Marker, Popup, TileLayer } = leaflet;
  const center: [number, number] = [origin.lat, origin.lng];
  const icons = useMemo(
    () => ({
      current: leaflet.divIcon({
        className: "community-map-marker",
        html: '<span class="block h-5 w-5 rounded-full bg-primary ring-8 ring-primary/20 shadow-card"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      place: leaflet.divIcon({
        className: "community-map-marker",
        html: '<span class="block h-3.5 w-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shadow-card"></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
      hotspot: leaflet.divIcon({
        className: "community-map-marker",
        html: '<span class="block h-4 w-4 rounded-full bg-red-500 ring-8 ring-red-500/20 shadow-card"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }),
    [leaflet],
  );

  return (
    <>
      <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full" zoomControl attributionControl>
        <MapOriginSync origin={origin} useMap={leaflet.useMap} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <Marker position={center} icon={icons.current}>
          <Popup>
            <strong>Current map center</strong>
            <br />
            {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
          </Popup>
        </Marker>
        {nearbyPlaces.map((place) => (
          <Marker key={place.id} position={[place.lat, place.lng]} icon={icons.place}>
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.type} · {place.distance.toFixed(1)} km away
            </Popup>
          </Marker>
        ))}
        {hotspotRows.map((row) => {
          const coords = row.coords ?? hotspotPositionFromExistingMarker(origin, row);
          return (
            <Marker key={row.area} position={[coords.lat, coords.lng]} icon={icons.hotspot} opacity={Math.max(0.45, row.level / 100)}>
              <Popup>
                <strong>{row.area}</strong>
                <br />
                {row.issue} · risk level {row.level}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {placesLoading && (
        <div className="pointer-events-none absolute inset-0 z-[1000] grid place-items-center bg-card/55 text-sm text-muted-foreground">
          Loading nearby Cape Town places...
        </div>
      )}
    </>
  );
}

function MapOriginSync({ origin, useMap }: { origin: MapPoint; useMap: LeafletModules["useMap"] }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([origin.lat, origin.lng], 13, { duration: 0.8 });
  }, [map, origin.lat, origin.lng]);

  return null;
}

function hotspotPositionFromExistingMarker(origin: MapPoint, row: HotspotRow) {
  return {
    lat: origin.lat + ((50 - row.top) / 38) * 0.025,
    lng: origin.lng + ((row.left - 50) / 42) * 0.025,
  };
}
