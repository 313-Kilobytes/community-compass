import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  Camera,
  ChevronDown,
  ChevronUp,
  Gauge,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  MessageSquareReply,
  MessageSquareText,
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
import type { AdminBroadcast } from "@/lib/server/admin-store";

type LocationHit = {
  label: string;
  lat: number;
  lng: number;
};

type FeedTab = "Nearby" | "Trending" | "Latest" | "Municipal Alerts";

const POST_CATEGORIES: PostCategory[] = ["Alert", "Event", "Job", "Community Update", "Safety Issue"];
const FEED_TABS: FeedTab[] = ["Nearby", "Trending", "Latest", "Municipal Alerts"];

const postCommentKey = (postId: string) => `post:${postId}`;

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Community Feed - Community Compass" },
      { name: "description", content: "Talk with people in your area, create posts, and share local information." },
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
  const [localAlerts, setLocalAlerts] = useState<AdminBroadcast[]>([]);

  useEffect(() => {
    const query = area.trim();
    if (query) setRegion(detectCapeTownRegion(query, coords));
    if (query.length < 4 || /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(query)) {
      setLocationHits([]);
      setLocationSearching(false);
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

  useEffect(() => {
    if (!user) {
      setLocalAlerts([]);
      return;
    }

    let cancelled = false;
    const loadLocalAlerts = async () => {
      const params = new URLSearchParams({ region: regionalFilter });
      const response = await fetch(`/api/broadcasts?${params.toString()}`, { credentials: "include" }).catch(() => null);
      if (cancelled || !response?.ok) return;
      const data = (await response.json().catch(() => ({}))) as { broadcasts?: AdminBroadcast[] };
      setLocalAlerts(data.broadcasts ?? []);
    };

    void loadLocalAlerts();
    const timer = window.setInterval(loadLocalAlerts, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [regionalFilter, user]);

  const canPost = message.trim().length > 0 || image;
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
      if (activeTab === "Municipal Alerts") {
        return post.category === "Alert" || analyzeIncident(post.message, Boolean(post.image)).category === "Infrastructure";
      }
      if (activeTab === "Nearby" && coords) {
        return post.coords ? distanceBetweenCoords(coords, post.coords) <= 15 : true;
      }
      return true;
    });

    const sortedByDate = [...filtered].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (activeTab === "Trending") {
      return sortedByDate.sort((a, b) => engagementForPost(b, areaComments) - engagementForPost(a, areaComments));
    }
    if (activeTab === "Nearby" && coords) {
      return [...sortedByDate].sort((a, b) => {
        const distanceA = a.coords ? distanceBetweenCoords(coords, a.coords) : Number.POSITIVE_INFINITY;
        const distanceB = b.coords ? distanceBetweenCoords(coords, b.coords) : Number.POSITIVE_INFINITY;
        return distanceA === distanceB ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : distanceA - distanceB;
      });
    }
    return sortedByDate;
  }, [activeTab, areaComments, coords, posts, regionalFilter]);

  const selectedRegionalThread = useMemo(
    () => allRegionalThreads.find((thread) => thread.region === regionalFilter) ?? emptyRegionalThread(regionalFilter),
    [allRegionalThreads, regionalFilter],
  );

  const liveActivity = useMemo(() => {
    const alerts = selectedRegionalThread.posts.filter((post) => post.category === "Alert" || post.category === "Safety Issue").length + localAlerts.length;
    const active = activeCounts[selectedRegionalThread.region] ?? 0;
    return [{ region: selectedRegionalThread.region, alerts, active }];
  }, [activeCounts, liveTick, localAlerts.length, selectedRegionalThread]);

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

  const addPostComment = (postId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAreaComments((current) => {
      const key = postCommentKey(postId);
      const next = {
        ...current,
        [key]: [
          ...(current[key] ?? []),
          {
            id: crypto.randomUUID(),
            author: user ? `@${user.username}` : name.trim() || t("feed.defaultName"),
            text: trimmed,
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

  const addPostReply = (postId: string, commentId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAreaComments((current) => {
      const key = postCommentKey(postId);
      const next = {
        ...current,
        [key]: (current[key] ?? []).map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                replies: [
                  ...comment.replies,
                  {
                    id: crypto.randomUUID(),
                    author: user ? `@${user.username}` : name.trim() || t("feed.defaultName"),
                    text: trimmed,
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

  const likePostComment = (postId: string, commentId: string) => {
    setAreaComments((current) => {
      const key = postCommentKey(postId);
      const next = { ...current, [key]: (current[key] ?? []).map((comment) => likeCommentTree(comment, commentId)) };
      saveAreaComments(next);
      broadcastCommunityChange();
      return next;
    });
  };

  const unlikePostComment = (postId: string, commentId: string) => {
    setAreaComments((current) => {
      const key = postCommentKey(postId);
      const next = { ...current, [key]: (current[key] ?? []).map((comment) => unlikeCommentTree(comment, commentId)) };
      saveAreaComments(next);
      broadcastCommunityChange();
      return next;
    });
  };

  const deletePostComment = (postId: string, commentId: string) => {
    const currentAuthor = user ? `@${user.username}` : name.trim() || t("feed.defaultName");
    setAreaComments((current) => {
      const key = postCommentKey(postId);
      const next = { ...current, [key]: deleteOwnCommentTree(current[key] ?? [], commentId, currentAuthor) };
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

  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-6xl mx-auto">
      <section className="relative overflow-hidden rounded-3xl mb-8 p-8 md:p-10 text-white shadow-elegant bg-[linear-gradient(135deg,#0f766e,#2563eb)]">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-25 blur-3xl bg-white" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-medium">
            <UsersRound className="h-3.5 w-3.5" /> {t("nav.feed")}
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-3">{t("feed.title")}</h1>
          <p className="text-white/90 mt-2">
            A simple place to talk with people nearby, post local updates, ask for help, and share what is happening in your area.
          </p>
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">{t("feed.compose")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Share a quick update, question, warning, or request with people nearby.</p>
            </div>
            <Link
              to="/create-post"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
            >
              <MessageSquareText className="h-3.5 w-3.5" /> Full post page
            </Link>
          </div>

          <form onSubmit={addPost} className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_190px]">
              {!user && (
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("feed.name")}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              <div className="relative">
                <input
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder={t("feed.area")}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {locationHits.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-elegant">
                    {locationHits.map((hit) => (
                      <button
                        key={`${hit.lat}-${hit.lng}`}
                        type="button"
                        onClick={() => chooseLocation(hit)}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-secondary"
                      >
                        {hit.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as PostCategory)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {POST_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What should people nearby know?"
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            {image && (
              <div className="relative inline-block">
                <img src={image} alt={t("feed.preview")} className="max-h-40 rounded-xl border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(undefined);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-background/90 px-2 py-1 text-xs font-semibold text-destructive"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleImage(event.target.files?.[0])} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Photo
                </button>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
                >
                  <MapPin className="h-3.5 w-3.5" /> Use location
                </button>
                <label className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-muted-foreground">
                  <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                  Post anonymously
                </label>
              </div>
              <button
                disabled={!canPost}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Post update
              </button>
            </div>
            {(locationSearching || locationError) && (
              <p className="text-xs text-muted-foreground">
                {locationSearching ? "Finding matching areas..." : locationError}
              </p>
            )}
          </form>
        </section>

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
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <select
                  value={regionalFilter}
                  onChange={(event) => setRegionalFilter(event.target.value as CapeTownRegion)}
                  className="min-w-48 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Choose feed area"
                >
                  {CAPE_TOWN_REGIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                {liveActivity.map((item) => (
                  <span key={item.region} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                    <Radio className="h-3.5 w-3.5 text-emerald-500" /> {item.alerts > 0 ? `${item.alerts} new alerts in ${item.region}` : activePeopleLabel(item.active, item.region)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="font-display text-lg font-semibold">Posts in {regionalFilter}</h2>
              <p className="text-sm text-muted-foreground">Read updates from nearby people and reply directly to any post.</p>
            </div>
            {sortedPosts.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
                <Camera className="h-6 w-6 mx-auto text-primary mb-3" />
                <p className="text-muted-foreground">{t("feed.empty")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedPosts.map((post) => (
                  <FeedArticle
                    key={post.id}
                    post={{ ...post, region: post.region ?? detectCapeTownRegion(post.area, post.coords) }}
                    comments={areaComments[postCommentKey(post.id)] ?? []}
                    currentAuthor={user ? `@${user.username}` : name.trim() || t("feed.defaultName")}
                    onComment={(text) => addPostComment(post.id, text)}
                    onReply={(commentId, text) => addPostReply(post.id, commentId, text)}
                    onLike={(commentId) => likePostComment(post.id, commentId)}
                    onUnlike={(commentId) => unlikePostComment(post.id, commentId)}
                    onDeleteComment={(commentId) => deletePostComment(post.id, commentId)}
                    onRemove={removePost}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
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
  localAlerts,
}: {
  thread: AreaThread;
  currentAuthor: string;
  onComment: (text: string) => void;
  onReply: (commentId: string, text: string) => void;
  onLike: (commentId: string) => void;
  onUnlike: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  localAlerts: AdminBroadcast[];
}) {
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(thread.posts.length > 0);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const alertCount = thread.posts.filter((post) => post.category === "Alert" || post.category === "Safety Issue").length + localAlerts.length;
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
        <button
          type="button"
          onClick={() => setAlertsExpanded((current) => !current)}
          className="rounded-lg bg-background/70 border border-border px-3 py-2 text-left hover:bg-muted"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bell className="h-3.5 w-3.5" /> Local alerts
            </span>
            <span className="text-sm font-bold tabular-nums truncate">{alertCount}</span>
          </div>
        </button>
        <Signal label="Engagement" value={String(thread.posts.length + commentCount + thread.chats.length)} icon={UsersRound} />
      </div>

      {alertsExpanded && (
        <div className="mt-4 grid gap-3">
          {localAlerts.length > 0 ? (
            localAlerts.slice(0, 4).map((alert) => (
              <article key={alert.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{alert.type}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{alert.message}</p>
                {alert.source && (
                  <a href={alert.source} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-primary">
                    View source
                  </a>
                )}
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
              No local alerts for this region right now.
            </div>
          )}
        </div>
      )}

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

function FeedArticle({
  post,
  comments,
  currentAuthor,
  onComment,
  onReply,
  onLike,
  onUnlike,
  onDeleteComment,
  onRemove,
}: {
  post: CommunityPost;
  comments: CommunityComment[];
  currentAuthor: string;
  onComment: (text: string) => void;
  onReply: (commentId: string, text: string) => void;
  onLike: (commentId: string) => void;
  onUnlike: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useT();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [reply, setReply] = useState("");
  const analysis = useMemo(() => analyzeIncident(post.message, Boolean(post.image)), [post.message, post.image]);
  const postRegion = post.region ?? detectCapeTownRegion(post.area, post.coords);
  const commentCount = countComments(comments);

  const submitReply = (event: React.FormEvent) => {
    event.preventDefault();
    onComment(reply);
    setReply("");
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
              {(post.anonymous ? "A" : post.name.replace(/^@/, "")[0] ?? "C").toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-semibold leading-tight">{post.anonymous ? "Anonymous" : post.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {postRegion}
                </span>
                <span>{post.category ?? "Community Update"}</span>
                <span>{new Date(post.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
          {!post.id.startsWith("starter") && (
            <button
              type="button"
              onClick={() => onRemove(post.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete post"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {post.message && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{post.message}</p>}
        {post.image && (
          <img
            src={post.image}
            alt={t("feed.preview")}
            className="mt-4 max-h-[520px] w-full rounded-xl border border-border object-cover"
          />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{commentCount} {commentCount === 1 ? "reply" : "replies"}</span>
          <span>Shared in {post.area || postRegion}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-y border-border py-2">
          <button
            type="button"
            onClick={() => document.getElementById(`reply-${post.id}`)?.focus()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <MessageSquareReply className="h-4 w-4" /> Reply
          </button>
          <button
            type="button"
            onClick={() => setShowAnalysis((current) => !current)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <BrainCircuit className="h-4 w-4" />
            {showAnalysis ? "Hide safety read" : "Safety read"}
          </button>
        </div>

        {showAnalysis && <AnalysisPanel analysis={analysis} />}

        <form onSubmit={submitReply} className="mt-4 flex gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
            {currentAuthor.replace(/^@/, "")[0]?.toUpperCase() ?? "Y"}
          </div>
          <input
            id={`reply-${post.id}`}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Write a reply..."
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={!reply.trim()}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Reply
          </button>
        </form>
      </div>

      {comments.length > 0 && (
        <div className="space-y-3 border-t border-border bg-secondary/20 p-4 md:p-5">
          {comments.map((comment) => (
            <PostReply
              key={comment.id}
              comment={comment}
              currentAuthor={currentAuthor}
              onReply={(text) => onReply(comment.id, text)}
              onLike={onLike}
              onUnlike={onUnlike}
              onDelete={onDeleteComment}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function PostReply({
  comment,
  currentAuthor,
  onReply,
  onLike,
  onUnlike,
  onDelete,
}: {
  comment: CommunityComment;
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
    <div className="flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background text-xs font-bold text-muted-foreground">
        {comment.author.replace(/^@/, "")[0]?.toUpperCase() ?? "C"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-background px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">{comment.author}</span>
            <span className="text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
          </div>
          <p className="mt-1 text-sm">{comment.text}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 px-2 text-xs font-semibold text-muted-foreground">
          <button type="button" onClick={() => onLike(comment.id)} className="hover:text-primary">Like {comment.likes ?? 0}</button>
          <button type="button" onClick={() => onUnlike(comment.id)} className="hover:text-primary">Unlike</button>
          {canDelete && <button type="button" onClick={() => onDelete(comment.id)} className="hover:text-destructive">Delete</button>}
          <span>{comment.replies.length} replies</span>
        </div>
        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-2">
            {comment.replies.map((item) => (
              <PostReply
                key={item.id}
                comment={item}
                currentAuthor={currentAuthor}
                onReply={onReply}
                onLike={onLike}
                onUnlike={onUnlike}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
        <form onSubmit={submitReply} className="mt-2 flex gap-2">
          <input
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Reply..."
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
          <button disabled={!reply.trim()} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
    </div>
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

function distanceBetweenCoords(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const earthRadiusKm = 6371;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const haversine = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const distance = 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
  return distance;
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
