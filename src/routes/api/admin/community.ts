import { createFileRoute } from "@tanstack/react-router";
import {
  clearCommunityHistory,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunitySnapshot,
} from "@/lib/server/community-store";
import { getAdminOperations } from "@/lib/server/admin-store";
import { json, requireSuperAdmin } from "@/lib/server/auth";

export const Route = createFileRoute("/api/admin/community")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      DELETE: async ({ request }: { request: Request }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });

        const url = new URL(request.url);
        const type = url.searchParams.get("type");
        const id = url.searchParams.get("id");

        if (type === "post" && id) return json({ community: await deleteCommunityPost(id), operations: await getAdminOperations() });
        if (type === "comment" && id) return json({ community: await deleteCommunityComment(id), operations: await getAdminOperations() });
        if (type === "all") return json({ community: await clearCommunityHistory(), operations: await getAdminOperations() });
        return json({ error: "Choose post, comment, or all." }, { status: 400 });
      },
      GET: async ({ request }: { request: Request }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });
        return json({ community: await getCommunitySnapshot(), operations: await getAdminOperations() });
      },
    },
  },
});
