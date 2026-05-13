import { analyzeIncident } from "@/lib/crisis-intelligence";
import { supabase } from "@/lib/supabase";

export type CommunityComment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  region?: CapeTownRegion;
  likes?: number;
  replies: CommunityComment[];
};

export type CapeTownRegion =
  | "Southern Suburbs"
  | "Northern Suburbs"
  | "Cape Flats"
  | "West Coast"
  | "Atlantic Seaboard"
  | "CBD & City Bowl"
  | "Helderberg"
  | "Atlantis"
  | "South Peninsula"
  | "Table View & Blouberg";

export type PostCategory = "Alert" | "Event" | "Job" | "Community Update" | "Safety Issue";

export type CommunityPost = {
  id: string;
  name: string;
  area: string;
  region?: CapeTownRegion;
  category?: PostCategory;
  message: string;
  image?: string;
  coords?: { lat: number; lng: number };
  anonymous?: boolean;
  createdAt: string;
};

export type CommunityChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type CommunityChatSession = {
  id: string;
  name: string;
  area: string;
  region?: CapeTownRegion;
  messages: CommunityChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type AreaThread = {
  area: string;
  region: CapeTownRegion;
  posts: CommunityPost[];
  chats: CommunityChatSession[];
  comments: CommunityComment[];
  updatedAt: string;
};

export type CommunitySnapshot = {
  posts: CommunityPost[];
  chatSessions: CommunityChatSession[];
  areaComments: Record<string, CommunityComment[]>;
  activeCounts: Partial<Record<CapeTownRegion, number>>;
};

export const FEED_STORAGE_KEY = "community-feed-posts";
export const CHAT_SESSIONS_STORAGE_KEY = "community-chat-sessions";
export const ACTIVE_CHAT_STORAGE_KEY = "community-active-chat-id";
export const AREA_COMMENTS_STORAGE_KEY = "community-area-comments";

export const CAPE_TOWN_REGIONS: CapeTownRegion[] = [
  "Southern Suburbs",
  "Northern Suburbs",
  "Cape Flats",
  "West Coast",
  "Atlantic Seaboard",
  "CBD & City Bowl",
  "Helderberg",
  "Atlantis",
  "South Peninsula",
  "Table View & Blouberg",
];

const REGION_KEYWORDS: Record<CapeTownRegion, string[]> = {
  "Southern Suburbs": [
    "southern suburbs",
    "claremont",
    "rondebosch",
    "newlands",
    "kenilworth",
    "wynberg",
    "constantia",
    "plumstead",
    "diep river",
    "mowbray",
    "observatory",
  ],
  "Northern Suburbs": [
    "northern suburbs",
    "bellville",
    "durbanville",
    "brackenfell",
    "kraaifontein",
    "parow",
    "goodwood",
    "edgemead",
    "elsies river",
    "tygerberg",
  ],
  "Cape Flats": [
    "cape flats",
    "khayelitsha",
    "mitchells plain",
    "gugulethu",
    "langa",
    "nyanga",
    "philippi",
    "athlone",
    "hanover park",
    "manenberg",
    "bonteheuwel",
    "blue downs",
  ],
  "West Coast": ["west coast", "melkbosstrand", "milnerton", "duyker eiland", "parklands", "sunningdale"],
  "Atlantic Seaboard": [
    "atlantic seaboard",
    "camps bay",
    "sea point",
    "green point",
    "fresnaye",
    "bantry bay",
    "clifton",
    "hout bay",
    "llandudno",
  ],
  "CBD & City Bowl": [
    "cbd",
    "city bowl",
    "cape town city centre",
    "foreshore",
    "woodstock",
    "salt river",
    "gardens",
    "tamboerskloof",
    "oranjezicht",
    "vredehoek",
    "bo-kaap",
    "de waterkant",
  ],
  Helderberg: ["helderberg", "somerset west", "strand", "gordon's bay", "gordons bay", "sir lowry's pass", "macassar"],
  Atlantis: ["atlantis", "mamre", "witsand", "pella"],
  "South Peninsula": [
    "south peninsula",
    "muizenberg",
    "fish hoek",
    "simon's town",
    "simons town",
    "kalk bay",
    "st james",
    "noordhoek",
    "kommetjie",
    "scarborough",
    "tokai",
  ],
  "Table View & Blouberg": ["table view", "blouberg", "bloubergstrand", "big bay", "flamingo vlei", "west beach", "sunset beach"],
};

export const STARTER_POSTS: CommunityPost[] = CAPE_TOWN_REGIONS.map((region, index) => ({
  id: `starter-${index + 1}`,
  name: "CommunityHub",
  area: region === "CBD & City Bowl" ? "Woodstock" : region,
  region,
  category: "Community Update",
  message: "Welcome to the community feed. Share updates, requests, photos, screenshots, and useful local notes here.",
  createdAt: new Date().toISOString(),
}));

export function normalizeArea(area: string) {
  return area.trim() || "Community wide";
}

export function detectCapeTownRegion(input: string, coords?: { lat: number; lng: number }): CapeTownRegion {
  const text = input.toLowerCase();
  for (const region of CAPE_TOWN_REGIONS) {
    if (REGION_KEYWORDS[region].some((keyword) => text.includes(keyword))) return region;
  }

  if (coords) {
    const { lat, lng } = coords;
    if (lat < -34.05 && lng > 18.3 && lng < 18.65) return "South Peninsula";
    if (lat < -34 && lng >= 18.75) return "Helderberg";
    if (lat > -33.68 && lng < 18.6) return "Atlantis";
    if (lng < 18.43 && lat < -33.99) return "Atlantic Seaboard";
    if (lng < 18.55 && lat > -33.9) return "Table View & Blouberg";
    if (lng > 18.55 && lat > -33.95) return "Northern Suburbs";
    if (lng > 18.48 && lat < -33.95 && lat > -34.08) return "Cape Flats";
    if (lng >= 18.4 && lng <= 18.55 && lat < -33.95) return "Southern Suburbs";
    if (lng < 18.7 && lat > -33.85) return "West Coast";
  }

  return "CBD & City Bowl";
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadFeedPosts() {
  return ensureRegionalStarterPosts(readJson<CommunityPost[]>(FEED_STORAGE_KEY, STARTER_POSTS));
}

export function ensureRegionalStarterPosts(posts: CommunityPost[]) {
  const starterRegions = new Set(posts.filter((post) => post.id.startsWith("starter-")).map((post) => post.region ?? detectCapeTownRegion(post.area, post.coords)));
  const missingStarters = STARTER_POSTS.filter((post) => !starterRegions.has(post.region ?? detectCapeTownRegion(post.area, post.coords)));
  return [...posts, ...missingStarters];
}

export function loadChatSessions() {
  return readJson<CommunityChatSession[]>(CHAT_SESSIONS_STORAGE_KEY, []);
}

export function loadAreaComments() {
  return readJson<Record<string, CommunityComment[]>>(AREA_COMMENTS_STORAGE_KEY, {});
}

export function saveAreaComments(comments: Record<string, CommunityComment[]>) {
  writeJson(AREA_COMMENTS_STORAGE_KEY, comments);
}

export async function loadCommunitySnapshot(): Promise<CommunitySnapshot | null> {
  try {
    const response = await fetch("/api/community", { credentials: "include" });
    if (!response.ok) return null;
    return (await response.json()) as CommunitySnapshot;
  } catch {
    return null;
  }
}

export async function saveCommunitySnapshot(snapshot: Omit<CommunitySnapshot, "activeCounts">) {
  try {
    const response = await fetch("/api/community", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(snapshot),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pingCommunityActivity(region: CapeTownRegion) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const response = await fetch("/api/community/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ region }),
    });
    if (!response.ok) return null;
    return (await response.json()) as { activeCounts: Partial<Record<CapeTownRegion, number>> };
  } catch {
    return null;
  }
}

export function buildAreaThreads(
  posts: CommunityPost[],
  chats: CommunityChatSession[],
  commentsByArea: Record<string, CommunityComment[]>,
) {
  const threads = new Map<string, AreaThread>();

  const ensureThread = (area: string, fallbackRegion?: CapeTownRegion) => {
    const region = fallbackRegion ?? detectCapeTownRegion(area);
    const label = region;
    if (!threads.has(label)) {
      threads.set(label, {
        area: label,
        region,
        posts: [],
        chats: [],
        comments: commentsByArea[label] ?? [],
        updatedAt: new Date(0).toISOString(),
      });
    }
    return threads.get(label)!;
  };

  for (const post of posts) {
    const thread = ensureThread(post.area, post.region);
    thread.posts.push(post);
    if (Date.parse(post.createdAt) > Date.parse(thread.updatedAt)) thread.updatedAt = post.createdAt;
  }

  for (const chat of chats) {
    const thread = ensureThread(chat.area, chat.region);
    thread.chats.push(chat);
    if (Date.parse(chat.updatedAt) > Date.parse(thread.updatedAt)) thread.updatedAt = chat.updatedAt;
  }

  for (const [area, comments] of Object.entries(commentsByArea)) {
    const thread = ensureThread(area, detectCapeTownRegion(area));
    for (const comment of comments) {
      if (Date.parse(comment.createdAt) > Date.parse(thread.updatedAt)) thread.updatedAt = comment.createdAt;
      for (const reply of comment.replies) {
        if (Date.parse(reply.createdAt) > Date.parse(thread.updatedAt)) thread.updatedAt = reply.createdAt;
      }
    }
  }

  return [...threads.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function summarizeArea(thread: AreaThread) {
  const latestPost = [...thread.posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!latestPost) return "No posts yet. Start the local discussion for this area.";
  const analysis = analyzeIncident(latestPost.message, Boolean(latestPost.image));
  return `${analysis.severity} ${analysis.category}: ${analysis.summary}`;
}
