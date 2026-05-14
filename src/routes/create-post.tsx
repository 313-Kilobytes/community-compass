import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Camera,
  EyeOff,
  Gauge,
  ImagePlus,
  LocateFixed,
  MapPin,
  MessageSquareText,
  MousePointer2,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { analyzeIncident, severityClass, type IncidentAnalysis } from "@/lib/crisis-intelligence";
import {
  CAPE_TOWN_REGIONS,
  CHAT_SESSIONS_STORAGE_KEY,
  FEED_STORAGE_KEY,
  detectCapeTownRegion,
  loadAreaComments,
  loadChatSessions,
  loadFeedPosts,
  saveCommunitySnapshot,
  writeJson,
  type CapeTownRegion,
  type CommunityPost,
  type PostCategory,
} from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

type LocationHit = {
  label: string;
  lat: number;
  lng: number;
};

const POST_CATEGORIES: PostCategory[] = ["Alert", "Event", "Job", "Community Update", "Safety Issue"];

export const Route = createFileRoute("/create-post")({
  head: () => ({
    meta: [
      { title: "Create Post - Community Compass" },
      { name: "description", content: "Create a local community update." },
    ],
  }),
  component: CreatePostPage,
});

function CreatePostPage() {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [region, setRegion] = useState<CapeTownRegion>("CBD & City Bowl");
  const [category, setCategory] = useState<PostCategory>("Community Update");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [anonymous, setAnonymous] = useState(false);
  const [locationHits, setLocationHits] = useState<LocationHit[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const canPost = message.trim().length > 0 || image;
  const draftAnalysis = useMemo(() => analyzeIncident(message, Boolean(image)), [message, image]);

  useEffect(() => {
    if (!user) return;
    const preferredLocation = user.currentLocation ?? user.permanentLocation;
    setName(user.fullName || user.username);
    setArea(preferredLocation.label);
    setRegion(preferredLocation.region);
    setCoords(preferredLocation.coords);
  }, [user]);

  useEffect(() => {
    const query = area.trim();
    if (query || coords) setRegion(detectCapeTownRegion(query, coords));
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
          q: `${query}, Cape Town, South Africa`,
          limit: "5",
          addressdetails: "1",
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
        if (!response.ok) throw new Error("Location search failed");
        const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        const hits = data
          .map((item) => ({ label: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }))
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
        setLocationHits(hits);
      } catch (error) {
        setLocationHits([]);
        setLocationError(error instanceof Error ? error.message : "Location search failed");
      } finally {
        setLocationSearching(false);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [area, coords]);

  const broadcastCommunityChange = () => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("community-feed");
      channel.postMessage({ type: "community-data" });
      channel.close();
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canPost) return;

    const post: CommunityPost = {
      id: crypto.randomUUID(),
      name: anonymous ? "Anonymous" : user ? `@${user.username}` : name.trim() || t("feed.defaultName"),
      area: area.trim() || region,
      region,
      category,
      message: message.trim(),
      image,
      coords,
      anonymous,
      createdAt: new Date().toISOString(),
    };
    const nextPosts = [post, ...loadFeedPosts().filter((item) => item.id !== post.id)];
    writeJson(FEED_STORAGE_KEY, nextPosts);
    writeJson(CHAT_SESSIONS_STORAGE_KEY, loadChatSessions());
    await saveCommunitySnapshot({
      posts: nextPosts.filter((item) => !item.id.startsWith("starter-")),
      chatSessions: loadChatSessions(),
      areaComments: loadAreaComments(),
    });
    broadcastCommunityChange();
    await navigate({ to: "/feed" });
  };

  const handleImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const chooseLocation = (hit: LocationHit) => {
    const nextCoords = { lat: Number(hit.lat.toFixed(5)), lng: Number(hit.lng.toFixed(5)) };
    setArea(hit.label);
    setCoords(nextCoords);
    setRegion(detectCapeTownRegion(hit.label, nextCoords));
    setLocationHits([]);
  };

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition((position) => {
      const next = {
        lat: Number(position.coords.latitude.toFixed(5)),
        lng: Number(position.coords.longitude.toFixed(5)),
      };
      setCoords(next);
      setRegion(detectCapeTownRegion(area, next));
      if (!area.trim()) setArea(`${next.lat}, ${next.lng}`);
    });
  };

  const dropPin = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const nextCoords = {
      lat: Number((90 - y * 180).toFixed(5)),
      lng: Number((-180 + x * 360).toFixed(5)),
    };
    setCoords(nextCoords);
    setRegion(detectCapeTownRegion(area, nextCoords));
    if (!area.trim()) setArea(`${nextCoords.lat}, ${nextCoords.lng}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-10 md:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Create post</h1>
          <p className="mt-1 text-sm text-muted-foreground">Share a local update, alert, event, job, or safety issue.</p>
        </div>
        <Link to="/feed" className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-muted">
          Back to feed
        </Link>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">{t("feed.compose")}</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {!anonymous && (
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("feed.name")} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          )}
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Address, suburb, or location" className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={region} onChange={(event) => setRegion(event.target.value as CapeTownRegion)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Region Group">
            {CAPE_TOWN_REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value as PostCategory)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Post category">
            {POST_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="mt-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Suggested region: <span className="font-semibold text-foreground">{region}</span>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> Stay anonymous
          </span>
          <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-4 w-4 accent-primary" />
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
                  <button key={`${hit.lat}-${hit.lng}-${hit.label}`} type="button" onClick={() => chooseLocation(hit)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
                    {hit.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={useCurrentLocation} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted">
          <LocateFixed className="h-3.5 w-3.5" /> {coords ? `Location saved: ${coords.lat}, ${coords.lng}` : "Use current location"}
        </button>
        <button type="button" onClick={dropPin} className="mt-3 relative h-44 w-full overflow-hidden rounded-xl border border-border bg-[linear-gradient(135deg,rgba(15,23,42,.08),rgba(15,23,42,.02))] text-left" aria-label="Drop a pin on the map">
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/85 px-2.5 py-1 text-[11px] font-semibold shadow-card">
            <MousePointer2 className="h-3.5 w-3.5 text-primary" /> Click map to drop pin
          </div>
          {coords && <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 ring-8 ring-red-500/20" style={{ left: `${((coords.lng + 180) / 360) * 100}%`, top: `${((90 - coords.lat) / 180) * 100}%` }} />}
        </button>

        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("feed.message")} className="mt-3 min-h-36 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />

        {image && (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-secondary/40">
            <img src={image} alt={t("feed.preview")} className="max-h-64 w-full object-cover" />
            <button type="button" onClick={() => setImage(undefined)} className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> {t("feed.removeImage")}
            </button>
          </div>
        )}

        {canPost && <AnalysisPanel analysis={draftAnalysis} />}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleImage(event.target.files?.[0])} />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted">
            <ImagePlus className="h-4 w-4" /> {t("feed.screenshot")}
          </button>
          <button type="submit" disabled={!canPost} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-50">
            <Send className="h-4 w-4" /> {t("feed.post")}
          </button>
        </div>
      </form>
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: IncidentAnalysis }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/45 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <BrainCircuit className="h-4 w-4 text-primary" />
          AI incident read
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass(analysis.severity)}`}>
            {analysis.severity}
          </span>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
            {analysis.category}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{analysis.summary}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Signal label="Trust" value={`${analysis.trust}%`} icon={ShieldCheck} />
        <Signal label="Panic" value={`${analysis.panic}%`} icon={Gauge} />
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 text-primary" /> Recommended action:
        </span>{" "}
        {analysis.action}
      </div>
    </div>
  );
}

function Signal({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
    </div>
  );
}
