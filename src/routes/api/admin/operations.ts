import { createFileRoute } from "@tanstack/react-router";
import {
  addCategory,
  addKeyword,
  createBroadcast,
  getAdminOperations,
  setAiSensitivity,
  setIncidentStatus,
  syncExternalAlerts,
  updateTicket,
  type AdminIncidentStatus,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/server/admin-store";
import { CAPE_TOWN_REGIONS, type CapeTownRegion } from "@/lib/community";
import { json, requireSuperAdmin } from "@/lib/server/auth";

export const Route = createFileRoute("/api/admin/operations")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });
        return json({ operations: await getAdminOperations() });
      },
      POST: async ({ request }: { request: Request }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        const actor = admin.user.username;
        let result:
          | Awaited<ReturnType<typeof setIncidentStatus>>
          | Awaited<ReturnType<typeof setAiSensitivity>>
          | Awaited<ReturnType<typeof createBroadcast>>
          | Awaited<ReturnType<typeof syncExternalAlerts>>
          | Awaited<ReturnType<typeof addCategory>>
          | Awaited<ReturnType<typeof addKeyword>>
          | Awaited<ReturnType<typeof updateTicket>>;

        if (body.type === "incident") {
          result = await setIncidentStatus(String(body.postId ?? ""), body.status as AdminIncidentStatus, actor);
        } else if (body.type === "ai_sensitivity") {
          result = await setAiSensitivity(Number(body.value), actor);
        } else if (body.type === "broadcast") {
          const region = CAPE_TOWN_REGIONS.includes(body.region as CapeTownRegion) ? (body.region as CapeTownRegion) : "CBD & City Bowl";
          result = await createBroadcast(region, String(body.alertType ?? "General"), String(body.message ?? ""), actor);
        } else if (body.type === "sync_external_alerts") {
          result = await syncExternalAlerts(actor);
        } else if (body.type === "category") {
          result = await addCategory(String(body.value ?? ""), actor);
        } else if (body.type === "keyword") {
          result = await addKeyword(String(body.value ?? ""), actor);
        } else if (body.type === "ticket") {
          result = await updateTicket(String(body.ticketId ?? ""), {
            status: body.status as TicketStatus,
            priority: body.priority as TicketPriority,
            adminResponse: typeof body.adminResponse === "string" ? body.adminResponse : undefined,
          }, actor);
        } else {
          return json({ error: "Unknown admin operation." }, { status: 400 });
        }

        if ("error" in result && result.error) return json({ error: result.error }, { status: 400 });
        return json({ operations: result.operations });
      },
    },
  },
});
