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
  source?: string;
  deliveredTo?: number;
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

export type ExternalAlert = {
  id: string;
  title: string;
  summary: string;
  region: CapeTownRegion;
  severity: "Low" | "Medium" | "High";
  source: string;
  publishedAt: string;
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
      broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts.map(sanitizeBroadcast).filter((item): item is AdminBroadcast => Boolean(item)).slice(0, 50) : [],
      categories: sanitizeStringList(parsed.categories, defaultCategories),
      keywords: sanitizeStringList(parsed.keywords, defaultKeywords),
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets.map(sanitizeTicket).filter((ticket): ticket is AdminTicket => Boolean(ticket)) : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, 100) as AdminAuditLog[] : [],
    };
  } catch {
    globalStore.__adminOperations ??= emptyStore();
  }
}

function sanitizeBroadcast(value: unknown): AdminBroadcast | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AdminBroadcast>;
  const message = sanitizeText(item.message, "", 1000);
  if (!message) return null;
  return {
    id: sanitizeText(item.id, crypto.randomUUID(), 120),
    region: sanitizeRegion(item.region),
    type: sanitizeText(item.type, "General", 60),
    message,
    source: sanitizeText(item.source, "", 180) || undefined,
    deliveredTo: Math.max(0, Math.floor(Number(item.deliveredTo) || 0)),
    createdAt: sanitizeDate(item.createdAt, new Date().toISOString()),
  };
}

function sanitizeRegion(value: unknown): CapeTownRegion {
  const regions: CapeTownRegion[] = [
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
  return regions.includes(value as CapeTownRegion) ? (value as CapeTownRegion) : "CBD & City Bowl";
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

export async function auditAdminAction(action: string, detail: string, actor: string) {
  await ensureAdminLoaded();
  store().auditLogs.unshift({
    id: crypto.randomUUID(),
    action,
    detail: `${detail} - by ${actor}`,
    actor,
    createdAt: new Date().toISOString(),
  });
  store().auditLogs = store().auditLogs.slice(0, 100);
  await saveAdmin();
}

export async function getAdminOperations() {
  await ensureAdminLoaded();
  return store();
}

export async function setUserStatus(userId: string, status: AdminUserStatus, actor: string) {
  await ensureAdminLoaded();
  if (!["Active", "Warned", "Muted 24h", "Banned 7d", "Suspended"].includes(status)) return { error: "Invalid user status." };
  store().userStatuses[userId] = { status, updatedAt: new Date().toISOString() };
  await auditAdminAction("User enforcement updated", `${userId} set to ${status}`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function setIncidentStatus(postId: string, status: AdminIncidentStatus, actor: string) {
  await ensureAdminLoaded();
  if (!["Verified", "Under Review", "False Information", "Resolved"].includes(status)) return { error: "Invalid incident status." };
  store().incidentStatuses[postId] = { status, updatedAt: new Date().toISOString() };
  await auditAdminAction("Incident status updated", `${postId} set to ${status}`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function setAiSensitivity(value: number, actor: string) {
  await ensureAdminLoaded();
  store().aiSensitivity = clampNumber(value, 30, 95, 68);
  await auditAdminAction("AI sensitivity updated", `Sensitivity set to ${store().aiSensitivity}%`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function createBroadcast(region: CapeTownRegion, type: string, message: string, actor: string) {
  await ensureAdminLoaded();
  const cleanMessage = sanitizeText(message, "", 1000);
  if (!cleanMessage) return { error: "Broadcast message is required." };
  const broadcast = { id: crypto.randomUUID(), region, type: sanitizeText(type, "General", 60), message: cleanMessage, deliveredTo: 0, createdAt: new Date().toISOString() };
  store().broadcasts.unshift(broadcast);
  store().broadcasts = store().broadcasts.slice(0, 50);
  await auditAdminAction("Broadcast sent", `${broadcast.type} sent to ${region}`, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function listBroadcastsForRegion(region: CapeTownRegion) {
  await ensureAdminLoaded();
  const broadcasts = store().broadcasts
    .filter((broadcast) => broadcast.region === region && isCapeTownBroadcast(broadcast))
    .slice(0, 20);
  return broadcasts.length ? broadcasts : fallbackBroadcastsForRegion(region);
}

export async function syncExternalAlerts(actor: string) {
  await ensureAdminLoaded();
  const alerts = await fetchExternalAlerts();
  let created = 0;
  for (const alert of alerts) {
    const duplicate = store().broadcasts.some((broadcast) => broadcast.source === alert.source || broadcast.message.includes(alert.title));
    if (duplicate) continue;
    if (alert.severity !== "High" && alert.severity !== "Medium") continue;
    store().broadcasts.unshift({
      id: crypto.randomUUID(),
      region: alert.region,
      type: alert.severity === "High" ? "Emergency alert" : "Public warning",
      message: `${alert.title}: ${alert.summary}`,
      source: alert.source,
      deliveredTo: 0,
      createdAt: alert.publishedAt,
    });
    created += 1;
  }
  store().broadcasts = store().broadcasts.slice(0, 50);
  await auditAdminAction("External alert sync", `${created} public alerts prepared for affected regions`, actor);
  await saveAdmin();
  return { operations: store(), alerts, created };
}

export async function addCategory(category: string, actor: string) {
  await ensureAdminLoaded();
  const clean = sanitizeText(category, "", 60);
  if (!clean) return { error: "Category is required." };
  if (!store().categories.some((item) => item.toLowerCase() === clean.toLowerCase())) store().categories.push(clean);
  await auditAdminAction("Category added", clean, actor);
  await saveAdmin();
  return { operations: store() };
}

export async function addKeyword(keyword: string, actor: string) {
  await ensureAdminLoaded();
  const clean = sanitizeText(keyword, "", 60);
  if (!clean) return { error: "Keyword is required." };
  if (!store().keywords.some((item) => item.toLowerCase() === clean.toLowerCase())) store().keywords.push(clean);
  await auditAdminAction("Moderation keyword added", clean, actor);
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
  await auditAdminAction("Ticket created", `${ticket.subject} from ${user.username}`, user.username);
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
  await auditAdminAction("Ticket updated", `${ticket.subject} set to ${ticket.status}`, actor);
  await saveAdmin();
  return { operations: store() };
}

async function fetchExternalAlerts(): Promise<ExternalAlert[]> {
  const sources = [
    "https://www.capetown.gov.za/",
    "https://www.capetown.gov.za/Local%20and%20communities/",
    "https://www.capetown.gov.za/Family%20and%20home/",
    "https://www.westerncape.gov.za/news",
  ];
  const fetched = await Promise.all(sources.map((source) => fetchCapeTownSource(source)));
  const alerts = fetched.flat();
  return dedupeAlerts(alerts.length ? alerts : fallbackCapeTownAlerts());
}

async function fetchCapeTownSource(source: string): Promise<ExternalAlert[]> {
  try {
    const response = await fetch(source, { headers: { "User-Agent": "CommunityHub/1.0" } });
    if (!response.ok) return [];
    const html = await response.text();
    return parseCapeTownAlerts(html, source);
  } catch {
    return [];
  }
}

function parseCapeTownAlerts(html: string, source: string): ExternalAlert[] {
  const text = decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  const compact = text.replace(/\s+/g, " ").trim();
  const alertPhrases = [
    /(?:SONA|Cycle Tour|Two Oceans Marathon|Cape Town Carnival)[^.!?]{0,180}(?:road closures|roads? will be closed|restrictions)[^.!?]{0,260}/gi,
    /(?:road closures|roads? will be closed|road closures and restrictions)[^.!?]{0,260}/gi,
    /(?:planned water maintenance|critical electricity work|load[- ]shedding|weather updates|adverse weather|localised flooding|electricity outages)[^.!?]{0,260}/gi,
  ];
  const alerts: ExternalAlert[] = [];
  for (const pattern of alertPhrases) {
    for (const match of compact.matchAll(pattern)) {
      const summary = cleanAlertText(match[0]);
      if (!summary || !isCapeTownRelevantText(summary)) continue;
      const title = titleFromAlert(summary);
      alerts.push({
        id: `${source}-${title}-${summary}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 140),
        title,
        summary,
        region: regionFromText(summary),
        severity: severityFromText(summary),
        source,
        publishedAt: new Date().toISOString(),
      });
    }
  }
  return alerts.slice(0, 5);
}

function fallbackCapeTownAlerts(): ExternalAlert[] {
  const now = new Date().toISOString();
  return [
    {
      id: "city-cno-weather-updates",
      title: "Cape Town weather updates",
      summary: "City of Cape Town notice: Subscribe to CNO Weather updates and monitor City channels for severe weather, flooding, wind, and service disruption notices.",
      region: "CBD & City Bowl",
      severity: "Medium",
      source: "https://www.capetown.gov.za/",
      publishedAt: now,
    },
    {
      id: "city-service-alerts",
      title: "Critical service updates",
      summary: "City of Cape Town notice: Check current City channels for critical electricity work, planned water maintenance, road closures, and service faults in your area.",
      region: "CBD & City Bowl",
      severity: "Medium",
      source: "https://www.capetown.gov.za/",
      publishedAt: now,
    },
  ];
}

function fallbackBroadcastsForRegion(region: CapeTownRegion): AdminBroadcast[] {
  return fallbackCapeTownAlerts().map((alert) => ({
    id: `${alert.id}-${region}`,
    region,
    type: alert.title,
    message: alert.summary,
    source: alert.source,
    deliveredTo: 0,
    createdAt: alert.publishedAt,
  }));
}

function dedupeAlerts(alerts: ExternalAlert[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = `${alert.title}-${alert.region}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function cleanAlertText(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+close alerts\s*/i, " ").trim().slice(0, 420);
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function titleFromAlert(text: string) {
  if (/road closure|roads? will be closed|restrictions/i.test(text)) return "Road closure";
  if (/weather|flood|wind|storm|rain/i.test(text)) return "Weather alert";
  if (/electricity|load[- ]shedding/i.test(text)) return "Electricity update";
  if (/water/i.test(text)) return "Water service update";
  return "Cape Town public notice";
}

function severityFromText(text: string): ExternalAlert["severity"] {
  if (/severe|emergency|flood|evacuat|outage|closed|closure|adverse weather|critical/i.test(text)) return "High";
  if (/warning|maintenance|restriction|load[- ]shedding|weather/i.test(text)) return "Medium";
  return "Low";
}

function isCapeTownBroadcast(broadcast: AdminBroadcast) {
  if (!broadcast.source) return true;
  return isCapeTownRelevantText(`${broadcast.type} ${broadcast.message} ${broadcast.source}`);
}

function isCapeTownRelevantText(text: string) {
  return /cape town|capetown\.gov\.za|western cape|westerncape\.gov\.za|south africa|city channels|city of cape town|cno weather|myciti|table mountain|green point|sea point|cbd|city bowl|southern suburbs|cape flats|northern suburbs|blouberg|mitchells plain|khayelitsha|bellville|claremont|muizenberg/i.test(text);
}

function regionFromText(text: string): CapeTownRegion {
  const lower = text.toLowerCase();
  if (/khayelitsha|mitchells plain|gugulethu|langa|nyanga|philippi|athlone|cape flats/.test(lower)) return "Cape Flats";
  if (/bellville|durbanville|brackenfell|parow|northern suburbs/.test(lower)) return "Northern Suburbs";
  if (/claremont|rondebosch|wynberg|constantia|southern suburbs/.test(lower)) return "Southern Suburbs";
  if (/somerset west|strand|helderberg|gordon/.test(lower)) return "Helderberg";
  if (/table view|blouberg|milnerton/.test(lower)) return "Table View & Blouberg";
  if (/sea point|camps bay|green point|hout bay|atlantic/.test(lower)) return "Atlantic Seaboard";
  if (/muizenberg|fish hoek|simon|noordhoek|south peninsula/.test(lower)) return "South Peninsula";
  if (/atlantis|mamre/.test(lower)) return "Atlantis";
  if (/west coast|melkbos/.test(lower)) return "West Coast";
  return "CBD & City Bowl";
}
