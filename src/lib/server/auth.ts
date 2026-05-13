import { CAPE_TOWN_REGIONS, detectCapeTownRegion, type CapeTownRegion } from "@/lib/community";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/supabase";

export type UserLocation = {
  label: string;
  region: CapeTownRegion;
  coords?: { lat: number; lng: number };
};

export type UserRole = "super_admin" | "regional_admin" | "community_moderator" | "verified_reporter" | "user";

export type UserProfile = {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  fullName?: string;
  permanentLocation: UserLocation;
  currentLocation?: UserLocation;
  createdAt: string;
  profilePicture?: string;
};

type ProfileRow = {
  user_id: string;
  username: string;
  email: string;
  role: UserRole | null;
  full_name: string | null;
  permanent_location: unknown;
  current_location: unknown | null;
  created_at: string;
  profile_picture: string | null;
};

const validRoles: UserRole[] = ["super_admin", "regional_admin", "community_moderator", "verified_reporter", "user"];
const defaultLocation: UserLocation = { label: "Cape Town", region: "Cape Flats" };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function configuredSuperAdminEmails() {
  return new Set((process.env.SUPER_ADMIN_EMAILS ?? "").split(",").map((email) => normalizeEmail(email)).filter(Boolean));
}

function roleForEmail(email?: string | null): UserRole {
  return email && configuredSuperAdminEmails().has(normalizeEmail(email)) ? "super_admin" : "user";
}

function usernameForAuthUser(user: SupabaseAuthUser) {
  const metadataUsername = user.user_metadata?.username;
  if (typeof metadataUsername === "string" && metadataUsername.trim()) return metadataUsername.trim().slice(0, 24);
  return (user.email?.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) || "user";
}

function nameForAuthUser(user: SupabaseAuthUser) {
  const metadataName = user.user_metadata?.full_name;
  return typeof metadataName === "string" ? validateName(metadataName) : undefined;
}

function bearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

function normalizeLocation(value: unknown): UserLocation {
  if (!value || typeof value !== "object") return defaultLocation;
  const location = value as Partial<UserLocation>;
  const label = typeof location.label === "string" && location.label.trim() ? location.label.trim() : defaultLocation.label;
  const coords =
    location.coords && Number.isFinite(Number(location.coords.lat)) && Number.isFinite(Number(location.coords.lng))
      ? { lat: Number(Number(location.coords.lat).toFixed(5)), lng: Number(Number(location.coords.lng).toFixed(5)) }
      : undefined;
  const region = validCapeTownRegion(location.region) ? location.region : detectCapeTownRegion(label, coords);
  return { label, coords, region };
}

function validCapeTownRegion(value: unknown): value is CapeTownRegion {
  return CAPE_TOWN_REGIONS.includes(value as CapeTownRegion);
}

function publicUser(profile: ProfileRow): UserProfile {
  return {
    userId: profile.user_id,
    username: profile.username,
    email: profile.email,
    role: profile.role ?? "user",
    fullName: profile.full_name ?? undefined,
    permanentLocation: normalizeLocation(profile.permanent_location),
    currentLocation: profile.current_location ? normalizeLocation(profile.current_location) : undefined,
    createdAt: profile.created_at,
    profilePicture: profile.profile_picture ?? undefined,
  };
}

async function profileForUserId(userId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (error || !data) return null;
  return publicUser(data as ProfileRow);
}

async function profileForAuthUser(user: SupabaseAuthUser) {
  const supabase = createServerSupabaseClient();
  const expectedRole = roleForEmail(user.email);
  const { data: existing, error: existingError } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();

  if (existing && !existingError) {
    if (expectedRole === "super_admin" && existing.role !== "super_admin") {
      const { data: promoted } = await supabase.from("profiles").update({ role: "super_admin" }).eq("user_id", user.id).select("*").single();
      if (promoted) return publicUser(promoted as ProfileRow);
    }
    return publicUser(existing as ProfileRow);
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      username: usernameForAuthUser(user),
      email: user.email ?? "",
      full_name: nameForAuthUser(user),
      permanent_location: defaultLocation as unknown as Json,
      role: expectedRole,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return publicUser(data as ProfileRow);
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function validateLocation(value: unknown): UserLocation | null {
  if (!value || typeof value !== "object") return null;
  const location = value as { label?: unknown; coords?: unknown };
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

export async function getUserFromRequest(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return profileForAuthUser(data.user);
}

export async function requireSuperAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return { error: "Your session has expired. Please sign in again.", status: 401 as const };
  if (user.role !== "super_admin") return { error: "Super admin access is required.", status: 403 as const };
  return { user };
}

export async function updateUserProfile(
  userId: string,
  patch: {
    username?: string;
    fullName?: string;
    currentLocation?: UserLocation | null;
    permanentLocation?: UserLocation;
    profilePicture?: string;
  },
) {
  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (patch.username) updates.username = patch.username.trim();
  if ("fullName" in patch) updates.full_name = validateName(patch.fullName);
  if ("profilePicture" in patch) updates.profile_picture = patch.profilePicture || null;
  if ("currentLocation" in patch) updates.current_location = patch.currentLocation as unknown as Json | null;
  if (patch.permanentLocation) updates.permanent_location = patch.permanentLocation as unknown as Json;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").update(updates).eq("user_id", userId).select("*").single();
  if (error || !data) return { error: error?.message ?? "User not found." };
  return { user: publicUser(data as ProfileRow) };
}

export async function listUsers() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as ProfileRow[]).map(publicUser);
}

export async function updateUserRole(userId: string, role: UserRole) {
  if (!validRoles.includes(role)) return { error: "Role is invalid." };

  const supabase = createServerSupabaseClient();
  const current = await profileForUserId(userId);
  if (!current) return { error: "User not found." };

  if (current.role === "super_admin" && role !== "super_admin") {
    const { count } = await supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) <= 1) return { error: "At least one super admin is required." };
  }

  const { data, error } = await supabase.from("profiles").update({ role }).eq("user_id", userId).select("*").single();
  if (error || !data) return { error: error?.message ?? "User not found." };
  return { user: publicUser(data as ProfileRow) };
}

export async function deleteUser(userId: string) {
  const supabase = createServerSupabaseClient();
  const current = await profileForUserId(userId);
  if (!current) return { error: "User not found." };

  if (current.role === "super_admin") {
    const { count } = await supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) <= 1) return { error: "At least one super admin is required." };
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return { ok: true };
}
