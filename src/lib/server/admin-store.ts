import type { CapeTownRegion } from "@/lib/community";

export type AdminUserStatus = "Active" | "Warned" | "Muted 24h" | "Banned 7d" | "Suspended";
export type AdminIncidentStatus = "Verified" | "Under Review" | "False Information" | "Resolved";
export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";

export type AdminTicket = {
  id: string;
  userId: string;
  username: string;
  email: string;
  subject: string;
  category: "Account" | "Appeal" | "Safety" | "Bug" | "Other";
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  adminResponse?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminBroadcast = {
  id: string;
  region: CapeTownRegion;
  type: string;
  message: string;
  createdAt: string;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
};

export type AdminOperations = {
  userStatuses: Record<string, { status: AdminUserStatus; note?: string; updatedAt: string }>;
  incidentStatuses: Record<string, { status: AdminIncidentStatus; updatedAt: string }>;
  aiSensitivity: number;
  broadcasts: AdminBroadcast[];
  categories: string[];
  keywords: string[];
  tickets: AdminTicket[];
  auditLogs: AdminAuditLog[];
};

const defaultCategories = ["Crime", "Safety", "Services", "Alerts", "Infrastructure", "Medical", "Weather", "Scams"];
const defaultKeywords = ["stolen", "shooting", "fire", "flood", "scam", "missing", "amanzi", "umlilo", "gevaar", "help"];

const globalStore = globalThis as typeof globalThis & {
  __adminOperations?: AdminOperations;
  __adminOperationsLoaded?: boolean;
};

function emptyStore(): AdminOperations {
  return {
    userStatuses: {},
    incidentStatuses: {},
    aiSensitivity: 68,
    broadcasts: [],
    categories: defaultCategories,
    keywords: defaultKeywords,
    tickets: [],
    auditLogs: [],
  };
}

function store() {
  globalStore.__adminOperations ??= emptyStore();
  return globalStore.__adminOperations;
}

async function adminStorePath() {
  if (typeof process === "undefined" || !process.versions?.node) return null;
  const path = await import("node:path");
  return path.join(process.cwd(), ".data", "admin-operations.json");
}

async function ensureAdminLoaded() {
  if (globalStore.__adminOperationsLoaded) return;
  globalStore.__adminOperationsLoaded = true;

  const filePath = await adminStorePath();
  if (!filePath) return;

  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AdminOperations>;
    globalStore.__adminOperations = {
      ...emptyStore(),
      ...parsed,
      userStatuses: sanitizeRecord(parsed.userStatuses),
      incidentStatuses: sanitizeRecord(parsed.incidentStatuses),
      aiSensitivity: clampNumber(parsed.aiSensitivity, 30, 95, 68),
      broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts.slice(0, 50) as AdminBroadcast[] : [],
      categories: sanitizeStringList(parsed.categories, defaultCategories),
      keywords: sanitizeStringList(parsed.keywords, defaultKeywords),
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets.map(sanitizeTicket).filter((ticket): ticket is AdminTicket => Boolean(ticket)) : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, 100) as AdminAuditLog[] : [],
    };
  } catch {
    globalStore.__adminOperations ??= emptyStore();
  }
}

async function saveAdmin() {
  const filePath = await adminStorePath();
  if (!filePath) return;

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(store(), null, 2), "utf8");
  } catch {
    /* Keep in-memory store when filesystem writes are unavailable. */
  }
}

function sanitizeRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === "object" ? (value as Record<string, T>) : {};
}

function sanitizeText(value: unknown, fallback = "", maxLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function sanitizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const next = value.map((item) => sanitizeText(item, "", 80)).filter(Boolean);
  return next.length ? [...new Set(next)] : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function sanitizeTicket(value: unknown): AdminTicket | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AdminTicket>;
  const subject = sanitizeText(item.subject, "", 120);
  const message = sanitizeText(item.message, "", 2000);
  if (!subject || !message) return null;
  const now = new Date().toISOString();
  return {
    id: sanitizeText(item.id, crypto.randomUUID(), 120),
    userId: sanitizeText(item.userId, "", 120),
    username: sanitizeText(item.username, "Community member", 80),
    email: sanitizeText(item.email, "", 160),
    subject,
    category: ["Account", "Appeal", "Safety", "Bug", "Other"].includes(item.category ?? "") ? item.category! : "Other",
    message,
    status: ["Open", "In Progress", "Resolved", "Closed"].includes(item.status ?? "") ? item.status! : "Open",
    priority: ["Low", "Medium", "High", "Urgent"].includes(item.priority ?? "") ? item.priority! : "Medium",
    adminResponse: sanitizeText(item.adminResponse, "", 2000) || undefined,
    createdAt: sanitizeDate(item.createdAt, now),
    updatedAt: sanitizeDate(item.updatedAt, now),
  };
}

function sanitizeDate(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

async function audit(action: string, detail: string, actor: string) {
  store().auditLogs.unshift({
    id: crypto.randomUUID(),
    action,
    detail,
    actor,
    createdAt: new Date().toISOString(),
  });
  store().auditLogs = store().auditLogs.slice(0, 100);
}

export async function getAdminOperations() {
  await ensureAdminLoaded();
  return store();
}

export async function setUserStatus(userId: string, status: AdminUserStatus, actor: string) {
  await ensureAdminLoaded();
  if (!["Active", "Warned", "Muted 24h", "Banned 7d", "Suspended"].includes(status)) return { error: "Invalid user status." };
  store().userStatuses[userId] = { status, updatedAt: new Date().toISOString() };
  await audit("User enforcement updated", `${userId} set to ${status}`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function setIncidentStatus(postId: string, status: AdminIncidentStatus, actor: string) {
  await ensureAdminLoaded();
  if (!["Verified", "Under Review", "False Information", "Resolved"].includes(status)) return { error: "Invalid incident status." };
  store().incidentStatuses[postId] = { status, updatedAt: new Date().toISOString() };
  await audit("Incident status updated", `${postId} set to ${status}`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function setAiSensitivity(value: number, actor: string) {
  await ensureAdminLoaded();
  store().aiSensitivity = clampNumber(value, 30, 95, 68);
  await audit("AI sensitivity updated", `Sensitivity set to ${store().aiSensitivity}%`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function createBroadcast(region: CapeTownRegion, type: string, message: string, actor: string) {
  await ensureAdminLoaded();
  const cleanMessage = sanitizeText(message, "", 1000);
  if (!cleanMessage) return { error: "Broadcast message is required." };
  const broadcast = { id: crypto.randomUUID(), region, type: sanitizeText(type, "General", 60), message: cleanMessage, createdAt: new Date().toISOString() };
  store().broadcasts.unshift(broadcast);
  store().broadcasts = store().broadcasts.slice(0, 50);
  await audit("Broadcast sent", `${broadcast.type} sent to ${region}`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function addCategory(category: string, actor: string) {
  await ensureAdminLoaded();
  const clean = sanitizeText(category, "", 60);
  if (!clean) return { error: "Category is required." };
  if (!store().categories.some((item) => item.toLowerCase() === clean.toLowerCase())) store().categories.push(clean);
  await audit("Category added", clean, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function addKeyword(keyword: string, actor: string) {
  await ensureAdminLoaded();
  const clean = sanitizeText(keyword, "", 60);
  if (!clean) return { error: "Keyword is required." };
  if (!store().keywords.some((item) => item.toLowerCase() === clean.toLowerCase())) store().keywords.push(clean);
  await audit("Moderation keyword added", clean, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function createTicket(user: { userId: string; username: string; email: string }, input: Partial<AdminTicket>) {
  await ensureAdminLoaded();
  const subject = sanitizeText(input.subject, "", 120);
  const message = sanitizeText(input.message, "", 2000);
  if (!subject) return { error: "Ticket subject is required." };
  if (!message) return { error: "Ticket message is required." };
  const now = new Date().toISOString();
  const ticket: AdminTicket = {
    id: crypto.randomUUID(),
    userId: user.userId,
    username: user.username,
    email: user.email,
    subject,
    category: ["Account", "Appeal", "Safety", "Bug", "Other"].includes(input.category ?? "") ? input.category! : "Other",
    message,
    status: "Open",
    priority: ["Low", "Medium", "High", "Urgent"].includes(input.priority ?? "") ? input.priority! : "Medium",
    createdAt: now,
    updatedAt: now,
  };
  store().tickets.unshift(ticket);
  await audit("Ticket created", `${ticket.subject} from ${user.username}`, user.username);
  await saveAdmin();
  return { ticket };
}

export async function listTicketsForUser(userId: string) {
  await ensureAdminLoaded();
  return store().tickets.filter((ticket) => ticket.userId === userId);
}

export async function updateTicket(ticketId: string, patch: Partial<AdminTicket>, actor: string) {
  await ensureAdminLoaded();
  const ticket = store().tickets.find((item) => item.id === ticketId);
  if (!ticket) return { error: "Ticket not found." };
  if (patch.status && ["Open", "In Progress", "Resolved", "Closed"].includes(patch.status)) ticket.status = patch.status;
  if (patch.priority && ["Low", "Medium", "High", "Urgent"].includes(patch.priority)) ticket.priority = patch.priority;
  if ("adminResponse" in patch) ticket.adminResponse = sanitizeText(patch.adminResponse, "", 2000) || undefined;
  ticket.updatedAt = new Date().toISOString();
  await audit("Ticket updated", `${ticket.subject} set to ${ticket.status}`, actor);
  await saveAdmin();
  return { operations: store() };
}
