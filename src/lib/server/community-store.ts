import {
  CAPE_TOWN_REGIONS,
  detectCapeTownRegion,
  type CapeTownRegion,
  type CommunityChatMessage,
  type CommunityChatSession,
  type CommunityComment,
  type CommunityPost,
  type CommunitySnapshot,
  type PostCategory,
} from "@/lib/community";
import { createServerSupabaseClient } from "@/lib/server/supabase";
import type { Database, Json } from "@/lib/types/supabase";

type ActiveUser = {
  userId: string;
  username: string;
  region: CapeTownRegion;
  lastSeenAt: string;
};

type CommunityPostRow = Database["public"]["Tables"]["community_posts"]["Row"];
type CommunityCommentRow = Database["public"]["Tables"]["community_comments"]["Row"];
type CommunityChatRow = Database["public"]["Tables"]["community_chat_sessions"]["Row"];

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const POST_CATEGORIES: PostCategory[] = ["Alert", "Event", "Job", "Community Update", "Safety Issue"];

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
              const payload = message as Partial<CommunityChatMessage>;
              const role = payload.role === "assistant" ? "assistant" : "user";
              const text = sanitizeText(payload.text, "", 3000);
              return text ? { role, text } : null;
            })
            .filter((message): message is CommunityChatMessage => Boolean(message))
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

function postFromRow(row: CommunityPostRow): CommunityPost {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    region: sanitizeRegion(row.region, row.area),
    category: POST_CATEGORIES.includes(row.category as PostCategory) ? row.category as PostCategory : "Community Update",
    message: row.message,
    image: row.image ?? undefined,
    coords: row.coords ? sanitizeCoords(row.coords) : undefined,
    anonymous: row.anonymous,
    createdAt: row.created_at,
  };
}

function chatFromRow(row: CommunityChatRow): CommunityChatSession {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    region: sanitizeRegion(row.region, row.area),
    messages: sanitizeChats([{ messages: row.messages, area: row.area, name: row.name, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }])[0]?.messages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function commentFromRow(row: CommunityCommentRow): CommunityComment {
  return {
    id: row.id,
    author: row.author,
    text: row.text,
    region: sanitizeRegion(row.region, ""),
    likes: row.likes,
    createdAt: row.created_at,
    replies: [],
  };
}

function buildAreaComments(rows: CommunityCommentRow[]) {
  const byId = new Map<string, CommunityComment>();
  const parentById = new Map<string, string | null>();
  const areaById = new Map<string, CapeTownRegion>();
  const output: Record<string, CommunityComment[]> = {};

  for (const row of rows) {
    byId.set(row.id, commentFromRow(row));
    parentById.set(row.id, row.parent_id);
    areaById.set(row.id, sanitizeRegion(row.region, ""));
  }

  for (const row of rows) {
    const comment = byId.get(row.id);
    if (!comment) continue;
    const parentId = parentById.get(row.id);
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.replies.push(comment);
      continue;
    }
    const region = areaById.get(row.id) ?? "CBD & City Bowl";
    output[region] ??= [];
    output[region].push(comment);
  }

  return output;
}

async function activeCounts() {
  const supabase = createServerSupabaseClient();
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  await supabase.from("community_active_users").delete().lt("last_seen_at", cutoff);
  const { data } = await supabase.from("community_active_users").select("region").gte("last_seen_at", cutoff);
  const counts: Partial<Record<CapeTownRegion, number>> = {};
  for (const active of data ?? []) {
    const region = sanitizeRegion(active.region, "");
    counts[region] = (counts[region] ?? 0) + 1;
  }
  return counts;
}

export async function getCommunitySnapshot(): Promise<CommunitySnapshot> {
  const supabase = createServerSupabaseClient();
  const [postsResult, chatsResult, commentsResult, counts] = await Promise.all([
    supabase.from("community_posts").select("*").order("created_at", { ascending: false }),
    supabase.from("community_chat_sessions").select("*").order("updated_at", { ascending: false }),
    supabase.from("community_comments").select("*").order("created_at", { ascending: true }),
    activeCounts(),
  ]);

  return {
    posts: (postsResult.data ?? []).map((row) => postFromRow(row as CommunityPostRow)),
    chatSessions: (chatsResult.data ?? []).map((row) => chatFromRow(row as CommunityChatRow)),
    areaComments: buildAreaComments((commentsResult.data ?? []) as CommunityCommentRow[]),
    activeCounts: counts,
  };
}

function flattenComments(areaComments: Record<string, CommunityComment[]>) {
  const rows: Database["public"]["Tables"]["community_comments"]["Insert"][] = [];
  const visit = (comment: CommunityComment, region: CapeTownRegion, parentId: string | null) => {
    rows.push({
      id: comment.id,
      parent_id: parentId,
      author: comment.author,
      text: comment.text,
      region,
      likes: comment.likes ?? 0,
      created_at: comment.createdAt,
    });
    for (const reply of comment.replies) visit(reply, region, comment.id);
  };

  for (const [regionKey, comments] of Object.entries(areaComments)) {
    const region = sanitizeRegion(regionKey, regionKey);
    for (const comment of comments) visit(comment, region, null);
  }
  return rows;
}

export async function saveCommunitySnapshot(input: {
  posts?: unknown;
  chatSessions?: unknown;
  areaComments?: unknown;
}) {
  const posts = sanitizePosts(input.posts);
  const chatSessions = sanitizeChats(input.chatSessions);
  const areaComments = sanitizeAreaComments(input.areaComments);
  const supabase = createServerSupabaseClient();

  await Promise.all([
    supabase.from("community_comments").delete().neq("id", "__none__"),
    supabase.from("community_posts").delete().neq("id", "__none__"),
    supabase.from("community_chat_sessions").delete().neq("id", "__none__"),
  ]);

  const postRows: Database["public"]["Tables"]["community_posts"]["Insert"][] = posts.map((post) => ({
    id: post.id,
    name: post.name,
    area: post.area,
    region: post.region ?? detectCapeTownRegion(post.area, post.coords),
    category: post.category ?? "Community Update",
    message: post.message,
    image: post.image ?? null,
    coords: post.coords ? post.coords as unknown as Json : null,
    anonymous: Boolean(post.anonymous),
    created_at: post.createdAt,
  }));

  const chatRows: Database["public"]["Tables"]["community_chat_sessions"]["Insert"][] = chatSessions.map((chat) => ({
    id: chat.id,
    name: chat.name,
    area: chat.area,
    region: chat.region ?? detectCapeTownRegion(chat.area),
    messages: chat.messages as unknown as Json,
    created_at: chat.createdAt,
    updated_at: chat.updatedAt,
  }));

  const commentRows = flattenComments(areaComments);

  if (postRows.length) await supabase.from("community_posts").insert(postRows);
  if (chatRows.length) await supabase.from("community_chat_sessions").insert(chatRows);
  if (commentRows.length) await supabase.from("community_comments").insert(commentRows);

  return getCommunitySnapshot();
}

export async function appendCommunityPost(post: CommunityPost) {
  const sanitized = sanitizePost(post);
  if (!sanitized) return getCommunitySnapshot();

  const supabase = createServerSupabaseClient();
  await supabase.from("community_posts").upsert({
    id: sanitized.id,
    name: sanitized.name,
    area: sanitized.area,
    region: sanitized.region ?? detectCapeTownRegion(sanitized.area, sanitized.coords),
    category: sanitized.category ?? "Community Update",
    message: sanitized.message,
    image: sanitized.image ?? null,
    coords: sanitized.coords ? sanitized.coords as unknown as Json : null,
    anonymous: Boolean(sanitized.anonymous),
    created_at: sanitized.createdAt,
  });

  return getCommunitySnapshot();
}

export async function clearCommunityHistory() {
  const supabase = createServerSupabaseClient();
  await Promise.all([
    supabase.from("community_comments").delete().neq("id", "__none__"),
    supabase.from("community_posts").delete().neq("id", "__none__"),
    supabase.from("community_chat_sessions").delete().neq("id", "__none__"),
  ]);
  return getCommunitySnapshot();
}

export async function deleteCommunityPost(postId: string) {
  const supabase = createServerSupabaseClient();
  await supabase.from("community_posts").delete().eq("id", postId);
  return getCommunitySnapshot();
}

export async function deleteCommunityComment(commentId: string) {
  const supabase = createServerSupabaseClient();
  await supabase.from("community_comments").delete().eq("id", commentId);
  return getCommunitySnapshot();
}

export async function recordCommunityActivity(user: { userId: string; username: string }, region: CapeTownRegion) {
  const supabase = createServerSupabaseClient();
  const active: Database["public"]["Tables"]["community_active_users"]["Insert"] = {
    user_id: user.userId,
    username: user.username,
    region,
    last_seen_at: new Date().toISOString(),
  };
  await supabase.from("community_active_users").upsert(active, { onConflict: "user_id" });
  return activeCounts();
}
