import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BrainCircuit, Camera, EyeOff, Gauge, ImagePlus, LocateFixed, MapPin, MessageSquareText, MousePointer2, Send, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { analyzeIncident, severityClass, type IncidentAnalysis } from "@/lib/crisis-intelligence";
import { useT } from "@/lib/i18n";

type FeedPost = {
  id: string;
  name: string;
  area: string;
  message: string;
  image?: string;
  coords?: { lat: number; lng: number };
  anonymous?: boolean;
  createdAt: string;
};

const STORAGE_KEY = "community-feed-posts";

type LocationHit = {
  label: string;
  lat: number;
  lng: number;
};

const starterPosts: FeedPost[] = [
  {
    id: "starter-1",
    name: "CommunityHub",
    area: "Central",
    message: "Welcome to the community feed. Share updates, requests, photos, screenshots, and useful local notes here.",
    createdAt: new Date().toISOString(),
  },
];

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Community Feed - CommunityHub" },
      { name: "description", content: "Share community updates, requests and screenshots." },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [anonymous, setAnonymous] = useState(false);
  const [locationHits, setLocationHits] = useState<LocationHit[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const query = area.trim();
    if (query.length < 4 || /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(query)) {
      setLocationHits([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLocationSearching(true);
      setLocationError(null);
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          q: query,
          limit: "5",
          addressdetails: "1",
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
        if (!response.ok) throw new Error("Location search failed");
        const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        const hits = data.map((item) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
        setLocationHits(hits);
        if (hits[0]) setCoords({ lat: Number(hits[0].lat.toFixed(5)), lng: Number(hits[0].lng.toFixed(5)) });
      } catch (error) {
        setLocationHits([]);
        setLocationError(error instanceof Error ? error.message : "Location search failed");
      } finally {
        setLocationSearching(false);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [area]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setPosts(saved ? JSON.parse(saved) : starterPosts);
    } catch {
      setPosts(starterPosts);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }, [posts]);

  const canPost = message.trim().length > 0 || image;
  const draftAnalysis = useMemo(() => analyzeIncident(message, Boolean(image)), [message, image]);

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [posts],
  );

  const addPost = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canPost) return;

    const post: FeedPost = {
      id: crypto.randomUUID(),
      name: anonymous ? "Anonymous" : name.trim() || t("feed.defaultName"),
      area: area.trim() || t("feed.defaultArea"),
      message: message.trim(),
      image,
      coords,
      anonymous,
      createdAt: new Date().toISOString(),
    };

    setPosts((current) => [post, ...current]);
    setMessage("");
    setImage(undefined);
    setCoords(undefined);
    setAnonymous(false);
    setLocationHits([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const removePost = (id: string) => {
    setPosts((current) => current.filter((post) => post.id !== id));
  };

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition((position) => {
      const next = {
        lat: Number(position.coords.latitude.toFixed(5)),
        lng: Number(position.coords.longitude.toFixed(5)),
      };
      setCoords(next);
      if (!area.trim()) setArea(`${next.lat}, ${next.lng}`);
    });
  };

  const chooseLocation = (hit: LocationHit) => {
    setArea(hit.label);
    setCoords({ lat: Number(hit.lat.toFixed(5)), lng: Number(hit.lng.toFixed(5)) });
    setLocationHits([]);
  };

  const dropPin = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const lng = Number((-180 + x * 360).toFixed(5));
    const lat = Number((90 - y * 180).toFixed(5));
    setCoords({ lat, lng });
    if (!area.trim()) setArea(`${lat}, ${lng}`);
  };

  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-6xl mx-auto">
      <section className="relative overflow-hidden rounded-3xl mb-8 p-8 md:p-10 text-white shadow-elegant bg-[linear-gradient(135deg,#0f766e,#2563eb)]">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-25 blur-3xl bg-white" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-medium">
            <UsersRound className="h-3.5 w-3.5" /> {t("nav.feed")}
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-3">{t("feed.title")}</h1>
          <p className="text-white/90 mt-2">{t("feed.subtitle")}</p>
        </div>
      </section>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        <form onSubmit={addPost} className="bg-card border border-border rounded-2xl p-5 shadow-card sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">{t("feed.compose")}</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {!anonymous && (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("feed.name")}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <div className="relative">
              <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder={t("feed.area")}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> Stay anonymous
            </span>
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
          {(locationSearching || locationError || locationHits.length > 0 || coords) && (
            <div className="mt-3 rounded-xl border border-border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold">Location match</span>
                {locationSearching && <span className="text-muted-foreground">Searching...</span>}
                {coords && <span className="text-muted-foreground">{coords.lat}, {coords.lng}</span>}
              </div>
              {locationError && <div className="mt-2 text-xs text-destructive">{locationError}</div>}
              {locationHits.length > 0 && (
                <div className="mt-2 space-y-1">
                  {locationHits.map((hit) => (
                    <button
                      key={`${hit.lat}-${hit.lng}-${hit.label}`}
                      type="button"
                      onClick={() => chooseLocation(hit)}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      {hit.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={useCurrentLocation}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
          >
            <LocateFixed className="h-3.5 w-3.5" /> {coords ? `Location saved: ${coords.lat}, ${coords.lng}` : "Use my current location"}
          </button>
          <button
            type="button"
            onClick={dropPin}
            className="mt-3 relative h-40 w-full overflow-hidden rounded-xl border border-border bg-[linear-gradient(135deg,rgba(15,23,42,.08),rgba(15,23,42,.02))] text-left"
            aria-label="Drop a pin on the map"
          >
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/85 px-2.5 py-1 text-[11px] font-semibold shadow-card">
              <MousePointer2 className="h-3.5 w-3.5 text-primary" /> Click map to drop pin
            </div>
            {coords && (
              <span
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 ring-8 ring-red-500/20"
                style={{ left: `${((coords.lng + 180) / 360) * 100}%`, top: `${((90 - coords.lat) / 180) * 100}%` }}
              />
            )}
          </button>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("feed.message")}
            className="mt-3 min-h-32 w-full resize-none px-3 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {image && (
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-secondary/40">
              <img src={image} alt={t("feed.preview")} className="max-h-56 w-full object-cover" />
              <button
                type="button"
                onClick={() => setImage(undefined)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("feed.removeImage")}
              </button>
            </div>
          )}

          {canPost && <AnalysisPanel analysis={draftAnalysis} compact />}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => handleImage(event.target.files?.[0])}
          />

          <div className="mt-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-muted transition-colors"
            >
              <ImagePlus className="h-4 w-4" /> {t("feed.screenshot")}
            </button>
            <button
              type="submit"
              disabled={!canPost}
              className="inline-flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-primary-foreground text-sm font-semibold shadow-elegant disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Send className="h-4 w-4" /> {t("feed.post")}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">{t("feed.localOnly")}</p>
        </form>

        <div className="space-y-4">
          {sortedPosts.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
              <Camera className="h-6 w-6 mx-auto text-primary mb-3" />
              <p className="text-muted-foreground">{t("feed.empty")}</p>
            </div>
          ) : (
            sortedPosts.map((post) => (
              <FeedArticle key={post.id} post={post} onRemove={removePost} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FeedArticle({ post, onRemove }: { post: FeedPost; onRemove: (id: string) => void }) {
  const { t } = useT();
  const analysis = useMemo(() => analyzeIncident(post.message, Boolean(post.image)), [post.message, post.image]);

  return (
    <article className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold">{post.anonymous ? "Anonymous" : post.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {post.area}
            </span>
            {post.coords && <span>{post.coords.lat}, {post.coords.lng}</span>}
            <span>{new Date(post.createdAt).toLocaleString()}</span>
          </div>
        </div>
        {!post.id.startsWith("starter") && (
          <button
            type="button"
            onClick={() => onRemove(post.id)}
            className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label={t("feed.removeImage")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {post.message && <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">{post.message}</p>}
      {post.image && (
        <img
          src={post.image}
          alt={t("feed.preview")}
          className="mt-4 max-h-[520px] w-full rounded-xl border border-border object-cover"
        />
      )}
      <AnalysisPanel analysis={analysis} />
    </article>
  );
}

function AnalysisPanel({ analysis, compact = false }: { analysis: IncidentAnalysis; compact?: boolean }) {
  return (
    <div className={`mt-4 rounded-xl border border-border bg-secondary/45 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <BrainCircuit className="h-4 w-4 text-primary" />
          AI incident read
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass(analysis.severity)}`}>
            {analysis.severity}
          </span>
          <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground border border-border">
            {analysis.category}
          </span>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{analysis.summary}</p>

      {!compact && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          <Signal label="Trust" value={`${analysis.trust}%`} icon={ShieldCheck} />
          <Signal label="Panic" value={`${analysis.panic}%`} icon={Gauge} />
        </div>
      )}

      <div className="mt-3 rounded-lg bg-background/70 border border-border px-3 py-2 text-xs">
        <span className="font-semibold inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-primary" /> Recommended action:
        </span>{" "}
        {analysis.action}
      </div>

      {analysis.matchedSignals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {analysis.matchedSignals.map((signal) => (
            <span key={signal} className="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {signal}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Signal({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-lg bg-background/70 border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
    </div>
  );
}
