import { detectCapeTownRegion, type CapeTownRegion } from "@/lib/community";

export type UserLocation = {
  label: string;
  region: CapeTownRegion;
  coords?: { lat: number; lng: number };
};

export type UserProfile = {
  userId: string;
  username: string;
  email: string;
  fullName?: string;
  permanentLocation: UserLocation;
  currentLocation?: UserLocation;
  createdAt: string;
  profilePicture?: string;
};

type StoredUser = UserProfile & {
  password: string;
};

type SessionPayload = {
  userId: string;
  exp: number;
};

const SESSION_COOKIE = "community_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const globalStore = globalThis as typeof globalThis & {
  __communityUsers?: StoredUser[];
  __communityUsersLoaded?: boolean;
};

function users() {
  globalStore.__communityUsers ??= [];
  return globalStore.__communityUsers;
}

async function userStorePath() {
  if (typeof process === "undefined" || !process.versions?.node) return null;
  const path = await import("node:path");
  return path.join(process.cwd(), ".data", "community-users.json");
}

async function ensureUsersLoaded() {
  if (globalStore.__communityUsersLoaded) return;
  globalStore.__communityUsersLoaded = true;

  const filePath = await userStorePath();
  if (!filePath) return;

  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoredUser[];
    if (Array.isArray(parsed)) globalStore.__communityUsers = parsed;
  } catch {
    globalStore.__communityUsers ??= [];
  }
}

async function saveUsers() {
  const filePath = await userStorePath();
  if (!filePath) return;

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(users(), null, 2), "utf8");
  } catch {
    /* In edge/serverless builds without a filesystem, keep the in-memory store. */
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function encodeBase64Url(input: ArrayBuffer | Uint8Array | string) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function sessionSecret() {
  return process.env.AUTH_SECRET || "community-compass-dev-secret-change-me";
}

async function signSession(payload: SessionPayload) {
  const body = encodeBase64Url(JSON.stringify(payload));
  const key = await importHmacKey(sessionSecret());
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${encodeBase64Url(signature)}`;
}

async function verifySession(token: string): Promise<SessionPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const key = await importHmacKey(sessionSecret());
  const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(body));
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(body))) as SessionPayload;
    if (!payload.userId || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return `pbkdf2_sha256$210000$${encodeBase64Url(salt)}$${encodeBase64Url(bits)}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, salt, hash] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !hash) return false;

  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: decodeBase64Url(salt), iterations: Number(iterations), hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const nextHash = encodeBase64Url(bits);
  if (nextHash.length !== hash.length) return false;
  let diff = 0;
  for (let index = 0; index < hash.length; index += 1) diff |= nextHash.charCodeAt(index) ^ hash.charCodeAt(index);
  return diff === 0;
}

function publicUser(user: StoredUser): UserProfile {
  const { password, ...profile } = user;
  return profile;
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [name, ...rest] = cookie.split("=");
        return [name, decodeURIComponent(rest.join("="))];
      }),
  );
}

function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function validateLocation(value: unknown): UserLocation | null {
  if (!value || typeof value !== "object") return null;
  const location = value as { label?: unknown; coords?: unknown; region?: unknown };
  const label = typeof location.label === "string" ? location.label.trim().slice(0, 160) : "";
  if (label.length < 2) return null;

  const coordsValue = location.coords as { lat?: unknown; lng?: unknown } | undefined;
  const coords =
    coordsValue &&
    Number.isFinite(Number(coordsValue.lat)) &&
    Number.isFinite(Number(coordsValue.lng))
      ? { lat: Number(Number(coordsValue.lat).toFixed(5)), lng: Number(Number(coordsValue.lng).toFixed(5)) }
      : undefined;

  return {
    label,
    coords,
    region: detectCapeTownRegion(label, coords),
  };
}

export function validateProfilePicture(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  if (!value.startsWith("data:image/") || value.length > 750_000) return undefined;
  return value;
}

export function validateName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 80);
  return trimmed || undefined;
}

export function validateUsername(username: unknown) {
  if (typeof username !== "string") return "Username is required.";
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(trimmed)) return "Username must be 3-24 letters, numbers, or underscores.";
  return null;
}

export function validateEmail(email: unknown) {
  if (typeof email !== "string") return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: unknown) {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/\d/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one symbol, like ! @ # $ %.";
  return null;
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  permanentLocation: UserLocation;
}) {
  await ensureUsersLoaded();
  const usernameKey = normalizeUsername(input.username);
  const emailKey = normalizeEmail(input.email);
  if (users().some((user) => normalizeUsername(user.username) === usernameKey)) {
    return { error: "Username is already taken." };
  }
  if (users().some((user) => normalizeEmail(user.email) === emailKey)) {
    return { error: "Email is already registered." };
  }

  const user: StoredUser = {
    userId: crypto.randomUUID(),
    username: input.username.trim(),
    email: emailKey,
    password: await hashPassword(input.password),
    fullName: validateName(input.fullName),
    permanentLocation: input.permanentLocation,
    createdAt: new Date().toISOString(),
  };
  users().push(user);
  await saveUsers();
  return { user: publicUser(user) };
}

export async function authenticate(identifier: string, password: string) {
  await ensureUsersLoaded();
  const key = identifier.trim().toLowerCase();
  const user = users().find((item) => normalizeEmail(item.email) === key || normalizeUsername(item.username) === key);
  if (!user) return { error: "No account was found for that email or username." };
  if (!(await verifyPassword(password, user.password))) return { error: "The password is incorrect." };
  return { user: publicUser(user) };
}

export async function createSession(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return signSession({ userId, exp });
}

export async function getUserFromRequest(request: Request) {
  await ensureUsersLoaded();
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = users().find((item) => item.userId === payload.userId);
  return user ? publicUser(user) : null;
}

export function withSession(user: UserProfile, token: string, status = 200) {
  return json({ user }, { status, headers: { "Set-Cookie": sessionCookie(token) } });
}

export async function updateUserProfile(userId: string, patch: {
  username?: string;
  fullName?: string;
  currentLocation?: UserLocation | null;
  permanentLocation?: UserLocation;
  profilePicture?: string;
}) {
  await ensureUsersLoaded();
  const user = users().find((item) => item.userId === userId);
  if (!user) return { error: "User not found." };

  if (patch.username && normalizeUsername(patch.username) !== normalizeUsername(user.username)) {
    if (users().some((item) => item.userId !== userId && normalizeUsername(item.username) === normalizeUsername(patch.username!))) {
      return { error: "Username is already taken." };
    }
    user.username = patch.username.trim();
  }

  if ("fullName" in patch) user.fullName = validateName(patch.fullName);
  if ("profilePicture" in patch) user.profilePicture = patch.profilePicture || undefined;
  if ("currentLocation" in patch) user.currentLocation = patch.currentLocation ?? undefined;
  if (patch.permanentLocation) user.permanentLocation = patch.permanentLocation;

  await saveUsers();
  return { user: publicUser(user) };
}
