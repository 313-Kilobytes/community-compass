import {
  CAPE_TOWN_REGIONS,
  detectCapeTownRegion,
  type CapeTownRegion,
  type CommunityChatSession,
  type CommunityComment,
  type CommunityPost,
  type CommunitySnapshot,
  type PostCategory,
} from "@/lib/community";

type ActiveUser = {
  userId: string;
  username: string;
  region: CapeTownRegion;
  lastSeenAt: string;
};

type StoredCommunity = Omit<CommunitySnapshot, "activeCounts"> & {
  activeUsers: ActiveUser[];
};

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const POST_CATEGORIES: PostCategory[] = ["Alert", "Event", "Job", "Community Update", "Safety Issue"];

const globalStore = globalThis as typeof globalThis & {
  __communityStore?: StoredCommunity;
  __communityStoreLoaded?: boolean;
};

function emptyStore(): StoredCommunity {
  return {
    posts: [],
    chatSessions: [],
    areaComments: {},
    activeUsers: [],
  };
}

function store() {
  globalStore.__communityStore ??= emptyStore();
  return globalStore.__communityStore;
}

async function communityStorePath() {
  if (typeof process === "undefined" || !process.versions?.node) return null;
  const path = await import("node:path");
  return path.join(process.cwd(), ".data", "community-feed.json");
}

async function ensureCommunityLoaded() {
  if (globalStore.__communityStoreLoaded) return;
  globalStore.__communityStoreLoaded = true;

  const filePath = await communityStorePath();
  if (!filePath) return;

  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredCommunity>;
    globalStore.__communityStore = {
      posts: sanitizePosts(parsed.posts),
      chatSessions: sanitizeChats(parsed.chatSessions),
      areaComments: sanitizeAreaComments(parsed.areaComments),
      activeUsers: sanitizeActiveUsers(parsed.activeUsers),
    };
  } catch {
    globalStore.__communityStore ??= emptyStore();
  }
}

async function saveCommunity() {
  const filePath = await communityStorePath();
  if (!filePath) return;

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(store(), null, 2), "utf8");
  } catch {
    /* Keep the in-memory store in edge/serverless builds without a filesystem. */
  }
}

function sanitizeText(value: unknown, fallback = "", maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function sanitizeDate(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function sanitizeRegion(value: unknown, fallbackText = ""): CapeTownRegion {
  return CAPE_TOWN_REGIONS.includes(value as CapeTownRegion)
    ? (value as CapeTownRegion)
    : detectCapeTownRegion(fallbackText);
}

function sanitizeCoords(value: unknown) {
  const coords = value as { lat?: unknown; lng?: unknown } | undefined;
  if (!coords) return undefined;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
}

function sanitizePost(value: unknown): CommunityPost | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CommunityPost>;
  const id = sanitizeText(item.id, crypto.randomUUID(), 120);
  if (id.startsWith("starter-")) return null;

  const area = sanitizeText(item.area, "Community wide", 180);
  const coords = sanitizeCoords(item.coords);
  const category = POST_CATEGORIES.includes(item.category as PostCategory) ? item.category : "Community Update";
  const image = typeof item.image === "string" && item.image.startsWith("data:image/") && item.image.length <= 750_000 ? item.image : undefined;

  return {
    id,
    name: sanitizeText(item.name, "Community member", 80),
    area,
    region: sanitizeRegion(item.region, area),
    category,
    message: sanitizeText(item.message, "", 4000),
    image,
    coords,
    anonymous: Boolean(item.anonymous),
    createdAt: sanitizeDate(item.createdAt),
  };
}

function sanitizePosts(value: unknown) {
  return Array.isArray(value) ? value.map(sanitizePost).filter((post): post is CommunityPost => Boolean(post)) : [];
}

function sanitizeComment(value: unknown): CommunityComment | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CommunityComment>;
  const text = sanitizeText(item.text, "", 2000);
  if (!text) return null;
  const region = sanitizeRegion(item.region, "");

  return {
    id: sanitizeText(item.id, crypto.randomUUID(), 120),
    author: sanitizeText(item.author, "Community member", 80),
    text,
    region,
    likes: Math.max(0, Math.floor(Number(item.likes) || 0)),
    createdAt: sanitizeDate(item.createdAt),
    replies: Array.isArray(item.replies)
      ? item.replies.map(sanitizeComment).filter((comment): comment is CommunityComment => Boolean(comment))
      : [],
  };
}

function sanitizeAreaComments(value: unknown) {
  const comments: Record<string, CommunityComment[]> = {};
  if (!value || typeof value !== "object") return comments;

  for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
    const region = sanitizeRegion(key, key);
    comments[region] = Array.isArray(list)
      ? list.map(sanitizeComment).filter((comment): comment is CommunityComment => Boolean(comment))
      : [];
  }
  return comments;
}

function sanitizeChats(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): CommunityChatSession | null => {
      if (!item || typeof item !== "object") return null;
      const chat = item as Partial<CommunityChatSession>;
      const area = sanitizeText(chat.area, "Community wide", 180);
      const messages = Array.isArray(chat.messages)
        ? chat.messages
            .map((message) => {
              if (!message || typeof message !== "object") return null;
              const payload = message as { role?: unknown; text?: unknown };
              const role = payload.role === "assistant" ? "assistant" : "user";
              const text = sanitizeText(payload.text, "", 3000);
              return text ? { role, text } : null;
            })
            .filter((message): message is { role: "user" | "assistant"; text: string } => Boolean(message))
        : [];

      return {
        id: sanitizeText(chat.id, crypto.randomUUID(), 120),
        name: sanitizeText(chat.name, "Community chat", 100),
        area,
        region: sanitizeRegion(chat.region, area),
        messages,
        createdAt: sanitizeDate(chat.createdAt),
        updatedAt: sanitizeDate(chat.updatedAt),
      };
    })
    .filter((chat): chat is CommunityChatSession => Boolean(chat));
}

function sanitizeActiveUsers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): ActiveUser | null => {
      if (!item || typeof item !== "object") return null;
      const active = item as Partial<ActiveUser>;
      const userId = sanitizeText(active.userId, "", 120);
      if (!userId) return null;
      return {
        userId,
        username: sanitizeText(active.username, "community-member", 80),
        region: sanitizeRegion(active.region, ""),
        lastSeenAt: sanitizeDate(active.lastSeenAt),
      };
    })
    .filter((active): active is ActiveUser => Boolean(active));
}

function activeCounts() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  const counts: Partial<Record<CapeTownRegion, number>> = {};
  store().activeUsers = store().activeUsers.filter((active) => Date.parse(active.lastSeenAt) >= cutoff);
  for (const active of store().activeUsers) {
    counts[active.region] = (counts[active.region] ?? 0) + 1;
  }
  return counts;
}

export async function getCommunitySnapshot(): Promise<CommunitySnapshot> {
  await ensureCommunityLoaded();
  return {
    posts: store().posts,
    chatSessions: store().chatSessions,
    areaComments: store().areaComments,
    activeCounts: activeCounts(),
  };
}

export async function saveCommunitySnapshot(input: {
  posts?: unknown;
  chatSessions?: unknown;
  areaComments?: unknown;
}) {
  await ensureCommunityLoaded();
  store().posts = sanitizePosts(input.posts);
  store().chatSessions = sanitizeChats(input.chatSessions);
  store().areaComments = sanitizeAreaComments(input.areaComments);
  await saveCommunity();
  return getCommunitySnapshot();
}

export async function clearCommunityHistory() {
  await ensureCommunityLoaded();
  store().posts = [];
  store().chatSessions = [];
  store().areaComments = {};
  await saveCommunity();
  return getCommunitySnapshot();
}

export async function deleteCommunityPost(postId: string) {
  await ensureCommunityLoaded();
  store().posts = store().posts.filter((post) => post.id !== postId);
  await saveCommunity();
  return getCommunitySnapshot();
}

function removeCommentTree(comments: CommunityComment[], commentId: string): CommunityComment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({ ...comment, replies: removeCommentTree(comment.replies, commentId) }));
}

export async function deleteCommunityComment(commentId: string) {
  await ensureCommunityLoaded();
  for (const [region, comments] of Object.entries(store().areaComments)) {
    store().areaComments[region] = removeCommentTree(comments, commentId);
  }
  await saveCommunity();
  return getCommunitySnapshot();
}

export async function recordCommunityActivity(user: { userId: string; username: string }, region: CapeTownRegion) {
  await ensureCommunityLoaded();
  const active = store().activeUsers.find((item) => item.userId === user.userId);
  const lastSeenAt = new Date().toISOString();
  if (active) {
    active.username = user.username;
    active.region = region;
    active.lastSeenAt = lastSeenAt;
  } else {
    store().activeUsers.push({ userId: user.userId, username: user.username, region, lastSeenAt });
  }
  await saveCommunity();
  return activeCounts();
}
