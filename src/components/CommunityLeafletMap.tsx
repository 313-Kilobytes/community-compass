import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";

type MapPoint = { lat: number; lng: number };

type CommunityMapPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating?: number;
  lat: number;
  lng: number;
};

type LeafletModules = {
  MapContainer: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  TileLayer: React.ComponentType<any>;
  useMap: () => { flyTo: (center: [number, number], zoom?: number, options?: { duration?: number }) => void };
  divIcon: (options: { className?: string; html?: string; iconSize?: [number, number]; iconAnchor?: [number, number] }) => unknown;
};

type CommunityLeafletMapProps = {
  center: MapPoint;
  places: CommunityMapPlace[];
  label: string;
  loading: boolean;
  zoom?: number;
};

export function CommunityLeafletMap({ center, places, label, loading, zoom = 16 }: CommunityLeafletMapProps) {
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

  return <CommunityMapSurface leaflet={leaflet} center={center} places={places} label={label} loading={loading} zoom={zoom} />;
}

function CommunityMapSurface({ leaflet, center, places, label, loading, zoom = 16 }: CommunityLeafletMapProps & { leaflet: LeafletModules }) {
  const { MapContainer, Marker, Popup, TileLayer } = leaflet;
  const mapCenter: [number, number] = [center.lat, center.lng];
  const icons = useMemo(
    () => ({
      center: leaflet.divIcon({
        className: "community-map-marker",
        html: '<span class="grid h-12 w-12 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-elegant ring-8 ring-primary/20">You</span>',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      }),
      place: (index: number) =>
        leaflet.divIcon({
          className: "community-map-marker",
          html: `<span class="grid h-8 w-8 place-items-center rounded-full border border-background bg-emerald-500 text-[10px] font-bold text-white shadow-card">${index + 1}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
    }),
    [leaflet],
  );

  return (
    <>
      <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom className="h-full w-full" zoomControl attributionControl>
        <CommunityMapCenterSync center={center} zoom={zoom} useMap={leaflet.useMap} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" maxZoom={19} />
        <Marker position={mapCenter} icon={icons.center}>
          <Popup>
            <strong>{label}</strong>
            <br />
            {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
          </Popup>
        </Marker>
        {places.slice(0, 16).map((place, index) => (
          <Marker key={`${place.id}-map-marker`} position={[place.lat, place.lng]} icon={icons.place(index)}>
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.category}
              {place.rating ? ` - ${place.rating.toFixed(1)} rating` : ""}
              <br />
              {place.address}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-[1000] grid place-items-center bg-card/55 text-sm text-muted-foreground">
          Loading nearby community places...
        </div>
      )}
    </>
  );
}

function CommunityMapCenterSync({ center, zoom, useMap }: { center: MapPoint; zoom: number; useMap: LeafletModules["useMap"] }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([center.lat, center.lng], zoom, { duration: 0.8 });
  }, [center.lat, center.lng, map, zoom]);

  return null;
}
