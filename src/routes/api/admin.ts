import { createFileRoute } from "@tanstack/react-router";
import { getCommunitySnapshot } from "@/lib/server/community-store";
import { getAdminOperations } from "@/lib/server/admin-store";
import { json, listUsers, requireSuperAdmin } from "@/lib/server/auth";

export const Route = createFileRoute("/api/admin")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });

        const [users, community, operations] = await Promise.all([listUsers(), getCommunitySnapshot(), getAdminOperations()]);
        return json({ users, community, operations });
      },
    },
  },
});
