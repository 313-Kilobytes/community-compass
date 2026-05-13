import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  Camera,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Gauge,
  Heart,
  ImagePlus,
  LocateFixed,
  MapPin,
  MessageCircle,
  MessageSquareReply,
  MessageSquareText,
  MousePointer2,
  Radio,
  Send,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { analyzeIncident, severityClass, type IncidentAnalysis } from "@/lib/crisis-intelligence";
import {
  AREA_COMMENTS_STORAGE_KEY,
  CAPE_TOWN_REGIONS,
  CHAT_SESSIONS_STORAGE_KEY,
  FEED_STORAGE_KEY,
  buildAreaThreads,
  detectCapeTownRegion,
  ensureRegionalStarterPosts,
  loadAreaComments,
  loadChatSessions,
  loadCommunitySnapshot,
  loadFeedPosts,
  pingCommunityActivity,
  saveAreaComments,
  saveCommunitySnapshot,
  writeJson,
  type AreaThread,
  type CapeTownRegion,
  type CommunityChatSession,
  type CommunityComment,
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

type FeedTab = "Nearby" | "Trending" | "Latest" | "Municipal Alerts";

const POST_CATEGORIES: PostCategory[] = ["Alert", "Event", "Job", "Community Update", "Safety Issue"];
const FEED_TABS: FeedTab[] = ["Nearby", "Trending", "Latest", "Municipal Alerts"];

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
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [chatSessions, setChatSessions] = useState<CommunityChatSession[]>([]);
  const [areaComments, setAreaComments] = useState<Record<string, CommunityComment[]>>({});
  const [communityLoaded, setCommunityLoaded] = useState(false);
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
  const [activeTab, setActiveTab] = useState<FeedTab>("Nearby");
  const [regionalFilter, setRegionalFilter] = useState<CapeTownRegion>("CBD & City Bowl");
  const [liveTick, setLiveTick] = useState(0);
  const [activeCounts, setActiveCounts] = useState<Partial<Record<CapeTownRegion, number>>>({});

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
        const hits = data.map((item) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
        setLocationHits(hits);
        if (hits[0]) {
          const nextCoords = { lat: Number(hits[0].lat.toFixed(5)), lng: Number(hits[0].lng.toFixed(5)) };
          setCoords(nextCoords);
          setRegion(detectCapeTownRegion(hits[0].label, nextCoords));
        }
      } catch (error) {
        setLocationHits([]);
        setLocationError(error instanceof Error ? error.message : "Location search failed");
      } finally {
        setLocationSearching(false);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [area, coords]);

  useEffect(() => {
    if (!user) return;
    const preferredLocation = user.currentLocation ?? user.permanentLocation;
    setName(user.fullName || user.username);
    setArea(preferredLocation.label);
    setRegion(preferredLocation.region);
    setRegionalFilter(preferredLocation.region);
    setCoords(preferredLocation.coords);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setPosts(loadFeedPosts());
    setChatSessions(loadChatSessions());
    setAreaComments(loadAreaComments());

    async function hydrateCommunity() {
      const snapshot = await loadCommunitySnapshot();
      if (cancelled) return;
      if (snapshot) {
        setPosts(ensureRegionalStarterPosts(snapshot.posts));
        setChatSessions(snapshot.chatSessions);
        setAreaComments(snapshot.areaComments);
        setActiveCounts(snapshot.activeCounts);
      }
      setCommunityLoaded(true);
    }

    void hydrateCommunity();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!communityLoaded) return;
    writeJson(FEED_STORAGE_KEY, posts);
    writeJson(CHAT_SESSIONS_STORAGE_KEY, chatSessions);
    saveAreaComments(areaComments);
    void saveCommunitySnapshot({
      posts: realPosts(posts),
      chatSessions,
      areaComments,
    });
  }, [areaComments, chatSessions, communityLoaded, posts]);

  useEffect(() => {
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("community-feed") : null;
    const syncCommunityData = (event?: StorageEvent | MessageEvent) => {
      const storageKey = event && "key" in event ? event.key : null;
      if (!storageKey || storageKey === FEED_STORAGE_KEY) setPosts(loadFeedPosts());
      if (!storageKey || storageKey === CHAT_SESSIONS_STORAGE_KEY) setChatSessions(loadChatSessions());
      if (!storageKey || storageKey === AREA_COMMENTS_STORAGE_KEY) setAreaComments(loadAreaComments());
      void loadCommunitySnapshot().then((snapshot) => {
        if (!snapshot) return;
        setPosts(ensureRegionalStarterPosts(snapshot.posts));
        setChatSessions(snapshot.chatSessions);
        setAreaComments(snapshot.areaComments);
        setActiveCounts(snapshot.activeCounts);
      });
      setLiveTick((current) => current + 1);
    };

    channel?.addEventListener("message", syncCommunityData);
    window.addEventListener("storage", syncCommunityData);
    window.addEventListener("community-data", syncCommunityData as EventListener);
    const timer = window.setInterval(() => setLiveTick((current) => current + 1), 8000);
    return () => {
      channel?.removeEventListener("message", syncCommunityData);
      channel?.close();
      window.removeEventListener("storage", syncCommunityData);
      window.removeEventListener("community-data", syncCommunityData as EventListener);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setActiveCounts({});
      return;
    }

    let cancelled = false;
    const regionToReport = user.currentLocation?.region ?? user.permanentLocation.region;
    const ping = async () => {
      const snapshot = await pingCommunityActivity(regionToReport);
      if (!cancelled && snapshot) setActiveCounts(snapshot.activeCounts);
    };

    void ping();
    const timer = window.setInterval(() => void ping(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

  const canPost = message.trim().length > 0 || image;
  const draftAnalysis = useMemo(() => analyzeIncident(message, Boolean(image)), [message, image]);

  const allRegionalThreads = useMemo(() => {
    const threads = buildAreaThreads(posts, chatSessions, areaComments);
    return CAPE_TOWN_REGIONS.map((regionName) => {
      const existing = threads.find((thread) => thread.region === regionName || thread.area === regionName);
      return existing ?? {
        area: regionName,
        region: regionName,
        posts: [],
        chats: [],
        comments: areaComments[regionName] ?? [],
        updatedAt: new Date(0).toISOString(),
      };
    });
  }, [areaComments, chatSessions, posts]);

  const sortedPosts = useMemo(() => {
    const withRegions = posts.map((post) => ({ ...post, region: post.region ?? detectCapeTownRegion(post.area, post.coords) }));
    const filtered = withRegions.filter((post) => {
      if (post.region !== regionalFilter) return false;
      if (activeTab === "Municipal Alerts") return post.category === "Alert" || analyzeIncident(post.message, Boolean(post.image)).category === "Infrastructure";
      return true;
    });
    const sorted = [...filtered].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (activeTab !== "Trending") return sorted;
    return sorted.sort((a, b) => engagementForPost(b, areaComments) - engagementForPost(a, areaComments));
  }, [activeTab, areaComments, posts, regionalFilter]);

  const recentChats = useMemo(
    () => [...chatSessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5),
    [chatSessions],
  );

  const selectedRegionalThread = useMemo(
    () => allRegionalThreads.find((thread) => thread.region === regionalFilter) ?? emptyRegionalThread(regionalFilter),
    [allRegionalThreads, regionalFilter],
  );

  const liveActivity = useMemo(() => {
    const alerts = selectedRegionalThread.posts.filter((post) => post.category === "Alert" || post.category === "Safety Issue").length;
    const active = activeCounts[selectedRegionalThread.region] ?? 0;
    return [{ region: selectedRegionalThread.region, alerts, active }];
  }, [activeCounts, liveTick, selectedRegionalThread]);

  const broadcastCommunityChange = () => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("community-feed");
      channel.postMessage({ type: "community-data" });
      channel.close();
    }
  };

  const addPost = (event: React.FormEvent) => {
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

    setPosts((current) => [post, ...current]);
    setMessage("");
    setImage(undefined);
    setCoords(undefined);
    setAnonymous(false);
    setLocationHits([]);
    broadcastCommunityChange();
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const removePost = (id: string) => {
    const post = posts.find((item) => item.id === id);
    const postRegion = post?.region ?? (post ? detectCapeTownRegion(post.area, post.coords) : undefined);
    setPosts((current) => current.filter((item) => item.id !== id));
    if (postRegion) {
      setAreaComments((current) => {
        const next = { ...current, [postRegion]: [] };
        saveAreaComments(next);
        return next;
      });
    }
    broadcastCommunityChange();
  };

  const addAreaComment = (threadRegion: CapeTownRegion, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAreaComments((current) => {
      const next = {
        ...current,
        [threadRegion]: [
          ...(current[threadRegion] ?? []),
          {
            id: crypto.randomUUID(),
            author: name.trim() || t("feed.defaultName"),
            text: trimmed,
            region: threadRegion,
            likes: 0,
            createdAt: new Date().toISOString(),
            replies: [],
          },
        ],
      };
      saveAreaComments(next);
      broadcastCommunityChange();
      return next;
    });
  };

  const addAreaReply = (threadRegion: CapeTownRegion, commentId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAreaComments((current) => {
      const next = {
        ...current,
        [threadRegion]: (current[threadRegion] ?? []).map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                replies: [
                  ...comment.replies,
                  {
                    id: crypto.randomUUID(),
                    author: name.trim() || t("feed.defaultName"),
                    text: trimmed,
                    region: threadRegion,
                    likes: 0,
                    createdAt: new Date().toISOString(),
                    replies: [],
                  },
                ],
              }
            : comment,
        ),
      };
      saveAreaComments(next);
      broadcastCommunityChange();
      return next;
    });
  };

  const likeAreaComment = (threadRegion: CapeTownRegion, commentId: string) => {
    setAreaComments((current) => {
      const next = {
        ...current,
        [threadRegion]: (current[threadRegion] ?? []).map((comment) => likeCommentTree(comment, commentId)),
      };
      saveAreaComments(next);
      broadcastCommunityChange();
      return next;
    });
  };

  const unlikeAreaComment = (threadRegion: CapeTownRegion, commentId: string) => {
    setAreaComments((current) => {
      const next = {
        ...current,
        [threadRegion]: (current[threadRegion] ?? []).map((comment) => unlikeCommentTree(comment, commentId)),
      };
      saveAreaComments(next);
      broadcastCommunityChange();
      return next;
    });
  };

  const deleteAreaComment = (threadRegion: CapeTownRegion, commentId: string) => {
    const currentAuthor = name.trim() || t("feed.defaultName");
    setAreaComments((current) => {
      const next = {
        ...current,
        [threadRegion]: deleteOwnCommentTree(current[threadRegion] ?? [], commentId, currentAuthor),
      };
      saveAreaComments(next);
      broadcastCommunityChange();
      return next;
    });
  };

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition((position) => {
      const next = {
        lat: Number(position.coords.latitude.toFixed(5)),
        lng: Number(position.coords.longitude.toFixed(5)),
      };
      const nextRegion = detectCapeTownRegion(area, next);
      setCoords(next);
      setRegion(nextRegion);
      if (!area.trim()) setArea(`${next.lat}, ${next.lng}`);
    });
  };

  const chooseLocation = (hit: LocationHit) => {
    const nextCoords = { lat: Number(hit.lat.toFixed(5)), lng: Number(hit.lng.toFixed(5)) };
    setArea(hit.label);
    setCoords(nextCoords);
    setRegion(detectCapeTownRegion(hit.label, nextCoords));
    setLocationHits([]);
  };

  const dropPin = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const lng = Number((-180 + x * 360).toFixed(5));
    const lat = Number((90 - y * 180).toFixed(5));
    const nextCoords = { lat, lng };
    setCoords(nextCoords);
    setRegion(detectCapeTownRegion(area, nextCoords));
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
                placeholder="Address, suburb, or location"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value as CapeTownRegion)}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Region Group"
            >
              {CAPE_TOWN_REGIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as PostCategory)}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Post category"
            >
              {POST_CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Suggested region: <span className="font-semibold text-foreground">{region}</span>
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
            <LocateFixed className="h-3.5 w-3.5" /> {coords ? `Location saved: ${coords.lat}, ${coords.lng}` : "Use Current Location"}
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
          <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap gap-2">
                {FEED_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-muted"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {liveActivity.map((item) => (
                  <span key={item.region} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                    <Radio className="h-3.5 w-3.5 text-emerald-500" /> {item.alerts > 0 ? `${item.alerts} new alerts in ${item.region}` : activePeopleLabel(item.active, item.region)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {recentChats.length > 0 && (
            <section className="bg-card border border-border rounded-2xl p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold">Community chat history</h2>
                  <p className="text-xs text-muted-foreground">Recent chats other users saved for the community feed.</p>
                </div>
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 grid gap-3">
                {recentChats.map((chat) => (
                  <ChatHistoryCard key={chat.id} chat={chat} />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold">Cape Town Regional Groups</h2>
                <p className="text-xs text-muted-foreground">Switch regions without changing the discussion card layout.</p>
              </div>
              <select
                value={regionalFilter}
                onChange={(event) => setRegionalFilter(event.target.value as CapeTownRegion)}
                className="min-w-56 px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Filter Cape Town regional groups"
              >
                {CAPE_TOWN_REGIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <AreaCard
              key="regional-filter-card"
              thread={selectedRegionalThread}
              currentAuthor={name.trim() || t("feed.defaultName")}
              onComment={(text) => addAreaComment(selectedRegionalThread.region, text)}
              onReply={(commentId, text) => addAreaReply(selectedRegionalThread.region, commentId, text)}
              onLike={(commentId) => likeAreaComment(selectedRegionalThread.region, commentId)}
              onUnlike={(commentId) => unlikeAreaComment(selectedRegionalThread.region, commentId)}
              onDeleteComment={(commentId) => deleteAreaComment(selectedRegionalThread.region, commentId)}
            />
          </section>

          {sortedPosts.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
              <Camera className="h-6 w-6 mx-auto text-primary mb-3" />
              <p className="text-muted-foreground">{t("feed.empty")}</p>
            </div>
          ) : (
            sortedPosts.map((post) => (
              <FeedArticle key={post.id} post={{ ...post, region: post.region ?? detectCapeTownRegion(post.area, post.coords) }} onRemove={removePost} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ChatHistoryCard({ chat }: { chat: CommunityChatSession }) {
  const preview = [...chat.messages].reverse().find((message) => message.role === "user") ?? chat.messages.at(-1);
  const region = chat.region ?? detectCapeTownRegion(chat.area);

  return (
    <article className="rounded-xl border border-border bg-secondary/35 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{chat.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {region}
            </span>
            <span>{new Date(chat.updatedAt).toLocaleString()}</span>
          </div>
        </div>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border">
          {chat.messages.length} messages
        </span>
      </div>
      {preview && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{preview.text}</p>}
    </article>
  );
}

function AreaCard({
  thread,
  currentAuthor,
  onComment,
  onReply,
  onLike,
  onUnlike,
  onDeleteComment,
}: {
  thread: AreaThread;
  currentAuthor: string;
  onComment: (text: string) => void;
  onReply: (commentId: string, text: string) => void;
  onLike: (commentId: string) => void;
  onUnlike: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(thread.posts.length > 0);
  const alertCount = thread.posts.filter((post) => post.category === "Alert" || post.category === "Safety Issue").length;
  const commentCount = countComments(thread.comments);
  const trending = summarizeTrending(thread);
  const active = thread.posts.length + thread.chats.length + commentCount > 0;

  const submitComment = (event: React.FormEvent) => {
    event.preventDefault();
    onComment(comment);
    setComment("");
    setExpanded(true);
  };

  return (
    <article className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> {thread.region}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{thread.posts.length} posts, {commentCount} comments</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-emerald-500 text-white" : "bg-secondary text-secondary-foreground"}`}>
            {active ? "Active now" : "Quiet"}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
            {Date.parse(thread.updatedAt) > 0 ? `Updated ${new Date(thread.updatedAt).toLocaleString()}` : "No activity yet"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-3 gap-2">
        <Signal label="Trending" value={trending} icon={MessageSquareText} />
        <Signal label="Local alerts" value={String(alertCount)} icon={Bell} />
        <Signal label="Engagement" value={String(thread.posts.length + commentCount + thread.chats.length)} icon={UsersRound} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Preview
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Join Discussion
        </button>
      </div>

      {expanded && (
        <>
          <div className="mt-4 grid sm:grid-cols-3 gap-2">
            {thread.posts.slice(0, 3).map((post) => (
              <div key={post.id} className="rounded-xl bg-secondary/35 border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span>{post.anonymous ? "Anonymous" : post.name}</span>
                  <span className="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{post.category ?? "Community Update"}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{post.message || "Image update"}</p>
              </div>
            ))}
            {thread.posts.length === 0 && (
              <div className="rounded-xl bg-secondary/35 border border-border px-3 py-2 text-xs text-muted-foreground sm:col-span-3">
                No regional posts yet.
              </div>
            )}
          </div>

          <form onSubmit={submitComment} className="mt-4 flex gap-2">
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={`Comment in ${thread.region}...`}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              <MessageSquareText className="h-4 w-4" /> Comment
            </button>
          </form>

          {thread.comments.length > 0 && (
            <div className="mt-4 space-y-3">
              {thread.comments.map((item) => (
                <AreaComment
                  key={item.id}
                  comment={item}
                  region={thread.region}
                  currentAuthor={currentAuthor}
                  onReply={(text) => onReply(item.id, text)}
                  onLike={onLike}
                  onUnlike={onUnlike}
                  onDelete={onDeleteComment}
                />
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function AreaComment({
  comment,
  region,
  currentAuthor,
  onReply,
  onLike,
  onUnlike,
  onDelete,
}: {
  comment: CommunityComment;
  region: CapeTownRegion;
  currentAuthor: string;
  onReply: (text: string) => void;
  onLike: (commentId: string) => void;
  onUnlike: (commentId: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const [reply, setReply] = useState("");
  const canDelete = comment.author === currentAuthor;

  const submitReply = (event: React.FormEvent) => {
    event.preventDefault();
    onReply(reply);
    setReply("");
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-semibold">{comment.author}</span>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span>{region}</span>
          <span>{new Date(comment.createdAt).toLocaleString()}</span>
        </span>
      </div>
      <p className="mt-2 text-sm">{comment.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => onLike(comment.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 font-semibold hover:bg-muted">
          <Heart className="h-3.5 w-3.5" /> Like {comment.likes ?? 0}
        </button>
        <button type="button" onClick={() => onUnlike(comment.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 font-semibold hover:bg-muted">
          Unlike
        </button>
        {canDelete && (
          <button type="button" onClick={() => onDelete(comment.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 font-semibold text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
        <span>{countComments(comment.replies)} replies</span>
        <span>{(comment.likes ?? 0) + countComments(comment.replies)} engagement</span>
      </div>
      {comment.replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-2 border-l border-border pl-3">
          {comment.replies.map((item) => (
            <div key={item.id} className="rounded-lg bg-background/70 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-semibold">{item.author}</span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span>{region}</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </span>
              </div>
              <p className="mt-1 text-sm">{item.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => onLike(item.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted">
                  <Heart className="h-3.5 w-3.5" /> Like {item.likes ?? 0}
                </button>
                <button type="button" onClick={() => onUnlike(item.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted">
                  Unlike
                </button>
                {item.author === currentAuthor && (
                  <button type="button" onClick={() => onDelete(item.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submitReply} className="mt-3 flex gap-2">
        <input
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Reply..."
          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold">
          <MessageSquareReply className="h-3.5 w-3.5" /> Reply
        </button>
      </form>
    </div>
  );
}

function FeedArticle({ post, onRemove }: { post: CommunityPost; onRemove: (id: string) => void }) {
  const { t } = useT();
  const analysis = useMemo(() => analyzeIncident(post.message, Boolean(post.image)), [post.message, post.image]);

  return (
    <article className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold">{post.anonymous ? "Anonymous" : post.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {post.region ?? detectCapeTownRegion(post.area, post.coords)}
            </span>
            <span>{post.category ?? "Community Update"}</span>
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
        <span className="text-sm font-bold tabular-nums truncate">{value}</span>
      </div>
    </div>
  );
}

function countComments(comments: CommunityComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

function likeCommentTree(comment: CommunityComment, targetId: string): CommunityComment {
  if (comment.id === targetId) return { ...comment, likes: (comment.likes ?? 0) + 1 };
  return { ...comment, replies: comment.replies.map((reply) => likeCommentTree(reply, targetId)) };
}

function unlikeCommentTree(comment: CommunityComment, targetId: string): CommunityComment {
  if (comment.id === targetId) return { ...comment, likes: Math.max(0, (comment.likes ?? 0) - 1) };
  return { ...comment, replies: comment.replies.map((reply) => unlikeCommentTree(reply, targetId)) };
}

function deleteOwnCommentTree(comments: CommunityComment[], targetId: string, currentAuthor: string): CommunityComment[] {
  return comments
    .filter((comment) => comment.id !== targetId || comment.author !== currentAuthor)
    .map((comment) => ({ ...comment, replies: deleteOwnCommentTree(comment.replies, targetId, currentAuthor) }));
}

function engagementForPost(post: CommunityPost, commentsByArea: Record<string, CommunityComment[]>) {
  const region = post.region ?? detectCapeTownRegion(post.area, post.coords);
  return countComments(commentsByArea[region] ?? []) + (post.image ? 2 : 0) + (post.category === "Alert" || post.category === "Safety Issue" ? 3 : 0);
}

function realPosts(posts: CommunityPost[]) {
  return posts.filter((post) => !post.id.startsWith("starter-"));
}

function activePeopleLabel(count: number, region: CapeTownRegion) {
  if (count === 0) return `No signed-in people active in ${region}`;
  if (count === 1) return `1 signed-in person active in ${region}`;
  return `${count} signed-in people active in ${region}`;
}

function summarizeTrending(thread: AreaThread) {
  const latestPost = [...thread.posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!latestPost) return "Open";
  return latestPost.category ?? analyzeIncident(latestPost.message, Boolean(latestPost.image)).category;
}

function emptyRegionalThread(region: CapeTownRegion): AreaThread {
  return {
    area: region,
    region,
    posts: [],
    chats: [],
    comments: [],
    updatedAt: new Date(0).toISOString(),
  };
}
