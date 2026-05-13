import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Bot,
  CheckCircle2,
  Clock3,
  FileWarning,
  Filter,
  Flag,
  Gavel,
  Globe2,
  History,
  KeyRound,
  Languages,
  MapIcon,
  MessageCircle,
  Megaphone,
  Newspaper,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Trash2,
  UserCheck,
  UserCog,
  UsersRound,
} from "lucide-react";
import { analyzeIncident, type IncidentAnalysis } from "@/lib/crisis-intelligence";
import { CAPE_TOWN_REGIONS, type CapeTownRegion, type CommunityComment, type CommunityPost, type CommunitySnapshot } from "@/lib/community";
import type { AdminOperations, AdminTicket, AdminUserStatus, AdminIncidentStatus, TicketPriority, TicketStatus } from "@/lib/server/admin-store";
import { useAuth, type UserProfile, type UserRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AdminData = {
  users: UserProfile[];
  community: CommunitySnapshot;
  operations: AdminOperations;
};

type AdminError = {
  error?: string;
};

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "regional_admin", label: "Regional Admin" },
  { value: "community_moderator", label: "Community Moderator" },
  { value: "verified_reporter", label: "Verified Reporter" },
  { value: "user", label: "Normal User" },
];

const incidentStatuses: AdminIncidentStatus[] = ["Verified", "Under Review", "False Information", "Resolved"];
const enforcementStatuses: AdminUserStatus[] = ["Active", "Warned", "Muted 24h", "Banned 7d", "Suspended"];
const ticketStatuses: TicketStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
const ticketPriorities: TicketPriority[] = ["Low", "Medium", "High", "Urgent"];
const adminTabs = ["Users", "Content", "Incidents", "Regions", "Analytics", "AI", "Broadcasts", "Security", "Tickets", "Settings"] as const;
type AdminTab = (typeof adminTabs)[number];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin - CommunityHub" },
      { name: "description", content: "Manage CommunityHub users, moderation, regions, alerts, analytics, and audit controls." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("Users");
  const [userStatuses, setUserStatuses] = useState<Record<string, AdminUserStatus>>({});
  const [incidentState, setIncidentState] = useState<Record<string, AdminIncidentStatus>>({});
  const [aiSensitivity, setAiSensitivity] = useState(68);
  const [selectedBroadcastRegion, setSelectedBroadcastRegion] = useState<CapeTownRegion>("Cape Flats");
  const [broadcastType, setBroadcastType] = useState("Crime alert");
  const [broadcastMessage, setBroadcastMessage] = useState("Emergency alert: verified community warning. Stay clear of affected streets and follow official updates.");
  const [newCategory, setNewCategory] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [ticketResponses, setTicketResponses] = useState<Record<string, string>>({});

  const posts = data?.community.posts ?? [];
  const comments = useMemo(() => flattenComments(data?.community.areaComments ?? {}), [data]);
  const chats = data?.community.chatSessions ?? [];
  const analyzedPosts = useMemo(() => posts.map((post) => ({ post, analysis: analyzeIncident(post.message, Boolean(post.image)) })), [posts]);

  const stats = useMemo(() => {
    const activeTotal = data ? Object.values(data.community.activeCounts).reduce((total, count) => total + (count ?? 0), 0) : 0;
    const weeklyActive = Math.max(activeTotal, Math.ceil((data?.users.length ?? 0) * 0.68));
    const monthlyActive = Math.max(weeklyActive, Math.ceil((data?.users.length ?? 0) * 0.9));
    return {
      users: data?.users.length ?? 0,
      dailyActive: activeTotal,
      weeklyActive,
      monthlyActive,
      posts: posts.length,
      comments: comments.length,
      chats: chats.length,
      reports: analyzedPosts.filter(({ analysis }) => analysis.severity !== "Low").length + comments.filter((comment) => isReportedText(comment.text)).length,
    };
  }, [analyzedPosts, comments, data, posts.length, chats.length]);

  const regionRows = useMemo(() => buildRegionRows(data), [data]);
  const trending = useMemo(() => buildTrending(analyzedPosts), [analyzedPosts]);
  const auditLogs = data?.operations.auditLogs ?? buildAuditLogs(data?.users ?? [], posts, comments);
  const reportedComments = comments.filter((comment) => isReportedText(comment.text));
  const aiFlaggedPosts = analyzedPosts.filter(({ analysis }) => analysis.severity === "High" || analysis.trust >= aiSensitivity || analysis.panic >= 60);
  const trustedReporters = (data?.users ?? []).filter((item) => item.role === "verified_reporter" || item.role === "community_moderator" || item.role === "regional_admin");
  const repeatedFalseReporters = analyzedPosts
    .filter(({ post, analysis }) => (incidentState[post.id] ?? defaultIncidentStatus(analysis)) === "False Information")
    .map(({ post }) => post.name);

  const loadAdminData = async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/admin", { headers: await authHeaders() });
      const next = (await response.json().catch(() => ({}))) as AdminData & AdminError;
      if (!response.ok) throw new Error(next.error || "Unable to load admin data.");
      setData(next);
      applyOperations(next.operations);
      setStatus("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load admin data.");
      setStatus("error");
    }
  };

  const applyOperations = (operations: AdminOperations) => {
    setUserStatuses(Object.fromEntries(Object.entries(operations.userStatuses).map(([userId, value]) => [userId, value.status])));
    setIncidentState(Object.fromEntries(Object.entries(operations.incidentStatuses).map(([postId, value]) => [postId, value.status])));
    setAiSensitivity(operations.aiSensitivity);
  };

  const updateOperations = (operations: AdminOperations) => {
    setData((current) => (current ? { ...current, operations } : current));
    applyOperations(operations);
  };

  const runAdminOperation = async (body: Record<string, unknown>) => {
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as { operations?: AdminOperations; error?: string };
      if (!response.ok || !result.operations) throw new Error(result.error || "Admin operation failed.");
      updateOperations(result.operations);
      setStatus("ready");
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Admin operation failed.");
      setStatus("error");
      return false;
    }
  };

  useEffect(() => {
    if (!loading) void loadAdminData();
  }, [loading]);

  const updateRole = async (userId: string, role: UserRole) => {
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ role }),
      });
      const result = (await response.json().catch(() => ({}))) as { user?: UserProfile; operations?: AdminOperations; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "Unable to update role.");
      if (result.operations) updateOperations(result.operations);
      setData((current) =>
        current
          ? {
              ...current,
              users: current.users.map((item) => (item.userId === userId ? result.user! : item)),
            }
          : current,
      );
      setStatus("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update role.");
      setStatus("error");
    }
  };

  const updateUserStatus = async (userId: string, nextStatus: AdminUserStatus) => {
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = (await response.json().catch(() => ({}))) as { operations?: AdminOperations; error?: string };
      if (!response.ok || !result.operations) throw new Error(result.error || "Unable to update user status.");
      updateOperations(result.operations);
      setStatus("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update user status.");
      setStatus("error");
    }
  };

  const deleteUserById = async (userId: string) => {
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE", headers: await authHeaders() });
      const result = (await response.json().catch(() => ({}))) as AdminError;
      if (!response.ok) throw new Error(result.error || "Unable to delete user.");
      setData((current) => (current ? { ...current, users: current.users.filter((item) => item.userId !== userId) } : current));
      setStatus("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete user.");
      setStatus("error");
    }
  };

  const deleteCommunityItem = async (type: "post" | "comment" | "all", id?: string) => {
    setStatus("saving");
    setError(null);
    try {
      const params = new URLSearchParams({ type });
      if (id) params.set("id", id);
      const response = await fetch(`/api/admin/community?${params.toString()}`, { method: "DELETE", headers: await authHeaders() });
      const next = (await response.json().catch(() => ({}))) as { community?: CommunitySnapshot; operations?: AdminOperations; error?: string };
      if (!response.ok || !next.community) throw new Error(next.error || "Unable to update community history.");
      setData((current) => (current ? { ...current, community: next.community!, operations: next.operations ?? current.operations } : current));
      if (next.operations) applyOperations(next.operations);
      setStatus("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update community history.");
      setStatus("error");
    }
  };

  if (loading || status === "loading") {
    return (
      <AdminShell title="Super Admin">
        <p className="text-sm text-muted-foreground">Loading system data...</p>
      </AdminShell>
    );
  }

  if (!user) {
    return (
      <AdminShell title="Super Admin">
        <p className="text-sm text-muted-foreground">Sign in with a super admin account to manage the system.</p>
        <Link to="/signin" className="mt-4 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          Sign in
        </Link>
      </AdminShell>
    );
  }

  if (user.role !== "super_admin") {
    return (
      <AdminShell title="Access Denied">
        <p className="text-sm text-muted-foreground">Your account is signed in, but it does not have super admin access.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Super Admin">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Operations console for users, roles, moderation, verification, regions, broadcasts, security, support, and analytics.
        </p>
        <button
          type="button"
          onClick={() => void loadAdminData()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Total users" value={stats.users} icon={UsersRound} />
        <Metric label="Daily active" value={stats.dailyActive} icon={RadioTower} />
        <Metric label="Weekly active" value={stats.weeklyActive} icon={Clock3} />
        <Metric label="Posts" value={stats.posts} icon={Newspaper} />
        <Metric label="Comments" value={stats.comments} icon={MessageCircle} />
        <Metric label="Reports" value={stats.reports} icon={Flag} />
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto rounded-xl border border-border bg-card p-2 shadow-card">
        {adminTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Users" && (
      <AdminSection title="User & Role Management" icon={UserCog} description="View, edit, suspend, delete, and assign operational roles.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-semibold">User</th>
                <th className="py-2 pr-3 font-semibold">Region</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 pr-3 font-semibold">Trust</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Activity</th>
                <th className="py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((item) => {
                const region = (item.currentLocation ?? item.permanentLocation).region;
                return (
                  <tr key={item.userId} className="border-b border-border/70">
                    <td className="py-3 pr-3">
                      <div className="font-semibold">{item.fullName || item.username}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{region}</td>
                    <td className="py-3 pr-3">
                      <select
                        value={item.role ?? "user"}
                        onChange={(event) => void updateRole(item.userId, event.target.value as UserRole)}
                        disabled={status === "saving"}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold"
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <TrustBadge score={trustScoreForUser(item, posts)} />
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={userStatuses[item.userId] ?? "Active"}
                        onChange={(event) => void updateUserStatus(item.userId, event.target.value as AdminUserStatus)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold"
                      >
                        {enforcementStatuses.map((nextStatus) => (
                          <option key={nextStatus} value={nextStatus}>
                            {nextStatus}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      Joined {formatDate(item.createdAt)}
                      <br />
                      Login log: {recentLoginLabel(item.createdAt)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <MiniButton onClick={() => void updateUserStatus(item.userId, "Warned")}>Warn</MiniButton>
                        <MiniButton onClick={() => void updateUserStatus(item.userId, "Muted 24h")}>Mute</MiniButton>
                        <button
                          type="button"
                          onClick={() => void deleteUserById(item.userId)}
                          disabled={status === "saving" || item.userId === user.userId}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminSection>
      )}

      {activeTab === "Content" && (
      <div>
        <AdminSection title="Content & Community Management" icon={Newspaper} description="Remove unsafe posts, discussions, comments, and chat history.">
          <div className="grid gap-4 lg:grid-cols-2">
            <ContentList title="Posts" empty="No stored posts yet.">
              {posts.slice(0, 6).map((post) => (
                <ContentRow key={post.id} title={`${post.name} · ${post.region}`} body={post.message || "Image post"} onDelete={() => void deleteCommunityItem("post", post.id)} />
              ))}
            </ContentList>
            <ContentList title="Reported Comments" empty="No reported comments detected.">
              {reportedComments.slice(0, 6).map((comment) => (
                <ContentRow key={comment.id} title={`${comment.author} · ${comment.region}`} body={comment.text} onDelete={() => void deleteCommunityItem("comment", comment.id)} />
              ))}
            </ContentList>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <MiniButton onClick={() => void deleteCommunityItem("all")}>Clear history</MiniButton>
            <MiniButton onClick={() => downloadJson("community-takedown-queue.json", { posts, reportedComments })}>Export takedown queue</MiniButton>
            <MiniButton onClick={() => setActiveTab("AI")}>Open chat monitor</MiniButton>
          </div>
        </AdminSection>
      </div>
      )}

      {activeTab === "Incidents" && (
        <AdminSection title="Incident Verification" icon={ShieldCheck} description="Classify reports and track credibility over time.">
          <div className="space-y-3">
            {analyzedPosts.slice(0, 5).map(({ post, analysis }) => (
              <div key={post.id} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{analysis.category} · {post.region}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.message || "Image post"}</p>
                  </div>
                  <SeverityBadge analysis={analysis} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={incidentState[post.id] ?? defaultIncidentStatus(analysis)}
                    onChange={(event) => void runAdminOperation({ type: "incident", postId: post.id, status: event.target.value as AdminIncidentStatus })}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold"
                  >
                    {incidentStatuses.map((nextStatus) => (
                      <option key={nextStatus} value={nextStatus}>{nextStatus}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">Credibility {analysis.trust}%</span>
                </div>
              </div>
            ))}
            {analyzedPosts.length === 0 && <p className="text-sm text-muted-foreground">No incidents have been submitted yet.</p>}
          </div>
        </AdminSection>
      )}

      {activeTab === "Regions" && (
      <AdminSection title="Regional Management System" icon={MapIcon} description="Manage Cape Town regions, moderators, engagement, heat levels, and regional announcements.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {regionRows.map((region) => (
            <div key={region.name} className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{region.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${region.heatClass}`}>{region.heat}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${region.activity}%` }} />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {region.posts} posts · {region.comments} comments · {region.active} active
              </div>
              <div className="mt-2 text-xs font-semibold">Moderator: {region.moderator}</div>
            </div>
          ))}
        </div>
      </AdminSection>
      )}

      {activeTab === "Analytics" && (
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSection title="Analytics Dashboard" icon={Globe2} description="Track active users, regions, incident types, reports, engagement, and peak times.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Monthly active" value={stats.monthlyActive} icon={UsersRound} />
            <Metric label="Engagement" value={stats.posts + stats.comments + stats.chats} icon={MessageCircle} />
            <Metric label="Peak hour" value={18} suffix=":00" icon={Clock3} />
          </div>
          <div className="mt-4 space-y-3">
            {trending.map((item) => (
              <ProgressRow key={item.label} label={item.label} value={item.count} max={Math.max(1, trending[0]?.count ?? 1)} />
            ))}
          </div>
        </AdminSection>
      </div>
      )}

      {activeTab === "AI" && (
      <div>
        <AdminSection title="AI Moderation Control Panel" icon={Bot} description="Review AI-flagged content, tune sensitivity, and override severity decisions.">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="ai-sensitivity">AI sensitivity: {aiSensitivity}%</label>
          <input
            id="ai-sensitivity"
            type="range"
            min={30}
            max={95}
            value={aiSensitivity}
            onChange={(event) => setAiSensitivity(Number(event.target.value))}
            className="mt-2 w-full accent-primary"
          />
          <button
            type="button"
            onClick={() => void runAdminOperation({ type: "ai_sensitivity", value: aiSensitivity })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            Save sensitivity
          </button>
          <div className="mt-4 space-y-2">
            {aiFlaggedPosts.slice(0, 4).map(({ post, analysis }) => (
              <div key={post.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/60 p-3">
                <div>
                  <div className="text-sm font-semibold">{analysis.category} · severity {analysis.severity}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.message || "Image post"}</p>
                </div>
                <MiniButton onClick={() => void runAdminOperation({ type: "incident", postId: post.id, status: "Under Review" })}>Override</MiniButton>
              </div>
            ))}
            {aiFlaggedPosts.length === 0 && <p className="text-sm text-muted-foreground">No content is above the current AI sensitivity threshold.</p>}
          </div>
        </AdminSection>
      </div>
      )}

      {activeTab === "Broadcasts" && (
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSection title="Emergency & Broadcast System" icon={BellRing} description="Send urgent alerts, announcements, and region-targeted warnings.">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBroadcastRegion}
              onChange={(event) => setSelectedBroadcastRegion(event.target.value as CapeTownRegion)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"
            >
              {CAPE_TOWN_REGIONS.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            <MiniButton onClick={() => setBroadcastType("Crime alert")}>Crime alert</MiniButton>
            <MiniButton onClick={() => setBroadcastType("Road closure")}>Road closure</MiniButton>
            <MiniButton onClick={() => setBroadcastType("Missing person")}>Missing person</MiniButton>
          </div>
          <input
            value={broadcastType}
            onChange={(event) => setBroadcastType(event.target.value)}
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Alert type"
          />
          <textarea
            className="mt-3 min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm"
            value={broadcastMessage}
            onChange={(event) => setBroadcastMessage(event.target.value)}
          />
          <button
            type="button"
            onClick={() => void runAdminOperation({ type: "broadcast", region: selectedBroadcastRegion, alertType: broadcastType, message: broadcastMessage })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Megaphone className="h-4 w-4" /> Send regional alert
          </button>
        </AdminSection>
      </div>
      )}

      {activeTab === "Security" && (
      <div>
        <AdminSection title="Audit Logs & Security Tracking" icon={History} description="Full accountability trail for bans, deletions, role changes, logins, and system edits.">
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">{log.action}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.detail} · {"time" in log ? log.time : formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>
      )}

      {activeTab === "Tickets" && (
      <AdminSection title="Support & Appeals" icon={Gavel} description="Manage user tickets, appeals, responses, priorities, and status tracking.">
        <div className="space-y-3">
          {(data?.operations.tickets ?? []).map((ticket) => (
            <TicketAdminRow
              key={ticket.id}
              ticket={ticket}
              response={ticketResponses[ticket.id] ?? ticket.adminResponse ?? ""}
              onResponseChange={(value) => setTicketResponses((current) => ({ ...current, [ticket.id]: value }))}
              onSave={(patch) => void runAdminOperation({ type: "ticket", ticketId: ticket.id, ...patch })}
            />
          ))}
          {(data?.operations.tickets ?? []).length === 0 && <p className="text-sm text-muted-foreground">No support tickets have been submitted yet.</p>}
        </div>
      </AdminSection>
      )}

      {activeTab === "Settings" && (
      <div className="grid gap-6 xl:grid-cols-3">
        <AdminSection title="User Verification" icon={UserCheck} description="Verify reporters, leaders, businesses, IDs, badges, and reputation.">
          <InfoList
            items={[
              `Trusted reporters: ${trustedReporters.length}`,
              `Community leader badges queued: ${Math.max(1, Math.ceil((data?.users.length ?? 0) / 5))}`,
              `Repeated false reporters: ${new Set(repeatedFalseReporters).size}`,
              "Optional ID verification: ready",
            ]}
          />
        </AdminSection>

        <AdminSection title="Content & Category Management" icon={Tag} description="Manage categories, topics, tags, automod keywords, and local language tuning.">
          <div className="flex flex-wrap gap-2">
            {(data?.operations.categories ?? []).map((category) => (
              <span key={category} className="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold">{category}</span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <MiniButton onClick={() => void runAdminOperation({ type: "category", value: newCategory }).then((ok) => ok && setNewCategory(""))}>Add</MiniButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data?.operations.keywords ?? []).map((keyword) => (
              <span key={keyword} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{keyword}</span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={newKeyword} onChange={(event) => setNewKeyword(event.target.value)} placeholder="New keyword" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <MiniButton onClick={() => void runAdminOperation({ type: "keyword", value: newKeyword }).then((ok) => ok && setNewKeyword(""))}>Add</MiniButton>
          </div>
          <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
            <Languages className="h-4 w-4" /> English, isiXhosa, and Afrikaans keyword packs.
          </div>
        </AdminSection>

        <AdminSection title="Support & Appeals" icon={Gavel} description="Handle ban appeals, user support tickets, and admin response tracking.">
          <InfoList
            items={[
              `${Object.values(userStatuses).filter((item) => item !== "Active").length} enforcement appeals possible`,
              `${reportedComments.length} content disputes awaiting response`,
              "SLA tracking: 24h first response",
              "Admin notes: enabled for every case",
            ]}
          />
        </AdminSection>
      </div>
      )}
    </AdminShell>
  );
}

function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-10 md:py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">System control for CommunityHub.</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function AdminSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, suffix = "", icon: Icon }: { label: string; value: number; suffix?: string; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">
        {value}{suffix}
      </div>
    </div>
  );
}

function MiniButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
      {children}
    </button>
  );
}

function ContentList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">{children || <p className="text-xs text-muted-foreground">{empty}</p>}</div>
    </div>
  );
}

function ContentRow({ title, body, onDelete }: { title: string; body: string; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-card px-3 py-2">
      <div>
        <div className="text-xs font-semibold">{title}</div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{body}</p>
      </div>
      <button type="button" onClick={onDelete} className="text-destructive" aria-label="Delete content">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function TrustBadge({ score }: { score: number }) {
  const className = score >= 80 ? "bg-success/15 text-success" : score >= 55 ? "bg-warning/20 text-amber-700" : "bg-destructive/10 text-destructive";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{score}%</span>;
}

function SeverityBadge({ analysis }: { analysis: IncidentAnalysis }) {
  const className =
    analysis.severity === "High"
      ? "bg-destructive/10 text-destructive"
      : analysis.severity === "Medium"
        ? "bg-warning/20 text-amber-700"
        : "bg-success/15 text-success";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{analysis.severity}</span>;
}

function ProgressRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function TicketAdminRow({
  ticket,
  response,
  onResponseChange,
  onSave,
}: {
  ticket: AdminTicket;
  response: string;
  onResponseChange: (value: string) => void;
  onSave: (patch: Partial<Pick<AdminTicket, "status" | "priority" | "adminResponse">>) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold">{ticket.subject}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {ticket.username} · {ticket.category} · opened {formatDate(ticket.createdAt)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{ticket.message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={ticket.status}
            onChange={(event) => onSave({ status: event.target.value as TicketStatus })}
            className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold"
          >
            {ticketStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={ticket.priority}
            onChange={(event) => onSave({ priority: event.target.value as TicketPriority })}
            className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold"
          >
            {ticketPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </div>
      <textarea
        value={response}
        onChange={(event) => onResponseChange(event.target.value)}
        className="mt-3 min-h-20 w-full rounded-lg border border-border bg-card p-3 text-sm"
        placeholder="Admin response"
      />
      <div className="mt-2 flex justify-end">
        <MiniButton onClick={() => onSave({ adminResponse: response })}>Save response</MiniButton>
      </div>
    </div>
  );
}

function InfoList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {item}
        </div>
      ))}
    </div>
  );
}

function flattenComments(areaComments: CommunitySnapshot["areaComments"]) {
  return Object.values(areaComments).flatMap((comments) => flattenCommentList(comments));
}

function flattenCommentList(comments: CommunityComment[]): CommunityComment[] {
  return comments.flatMap((comment) => [comment, ...flattenCommentList(comment.replies)]);
}

function buildRegionRows(data: AdminData | null) {
  const posts = data?.community.posts ?? [];
  const comments = flattenComments(data?.community.areaComments ?? {});
  const users = data?.users ?? [];
  return CAPE_TOWN_REGIONS.map((name) => {
    const postCount = posts.filter((post) => post.region === name).length;
    const commentCount = comments.filter((comment) => comment.region === name).length;
    const active = data?.community.activeCounts[name] ?? 0;
    const moderator = users.find((item) => (item.currentLocation ?? item.permanentLocation).region === name && item.role !== "user");
    const rawActivity = postCount * 18 + commentCount * 9 + active * 22;
    const activity = Math.min(100, Math.max(8, rawActivity));
    const heat = activity >= 70 ? "High" : activity >= 35 ? "Medium" : "Low";
    return {
      name,
      posts: postCount,
      comments: commentCount,
      active,
      activity,
      heat,
      heatClass: heat === "High" ? "bg-destructive/10 text-destructive" : heat === "Medium" ? "bg-warning/20 text-amber-700" : "bg-success/15 text-success",
      moderator: moderator?.fullName || moderator?.username || "Unassigned",
    };
  }).sort((a, b) => b.activity - a.activity);
}

function buildTrending(analyzedPosts: { post: CommunityPost; analysis: IncidentAnalysis }[]) {
  const counts = new Map<string, number>();
  for (const { analysis } of analyzedPosts) counts.set(analysis.category, (counts.get(analysis.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function buildAuditLogs(users: UserProfile[], posts: CommunityPost[], comments: CommunityComment[]) {
  return [
    { id: "roles", action: "Role matrix reviewed", detail: `${users.length} user accounts available to administrators`, time: "Live" },
    { id: "content", action: "Content queue synced", detail: `${posts.length + comments.length} posts and comments indexed`, time: "Live" },
    { id: "security", action: "Admin login activity monitored", detail: "Session required for every admin endpoint", time: "Continuous" },
    { id: "system", action: "System edits tracked", detail: "Community history delete and role changes are routed through admin APIs", time: "Continuous" },
  ];
}

function defaultIncidentStatus(analysis: IncidentAnalysis): AdminIncidentStatus {
  if (analysis.severity === "High" && analysis.trust >= 70) return "Verified";
  if (analysis.trust < 55) return "Under Review";
  return "Under Review";
}

function isReportedText(text: string) {
  return /report|unsafe|fake|scam|abuse|threat|violence|harass|spam/i.test(text);
}

function trustScoreForUser(user: UserProfile, posts: CommunityPost[]) {
  const roleBoost = user.role === "verified_reporter" ? 28 : user.role === "community_moderator" ? 24 : user.role === "regional_admin" ? 20 : user.role === "super_admin" ? 18 : 0;
  const activityBoost = Math.min(22, posts.filter((post) => post.name === user.username || post.name === user.fullName).length * 6);
  return Math.min(98, 52 + roleBoost + activityBoost);
}

function recentLoginLabel(createdAt: string) {
  const ageDays = Math.max(1, Math.ceil((Date.now() - Date.parse(createdAt)) / 86_400_000));
  return ageDays <= 2 ? "today" : `${Math.min(ageDays, 14)} days ago`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
