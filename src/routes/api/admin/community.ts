import { createFileRoute } from "@tanstack/react-router";
import {
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunitySnapshot,
} from "@/lib/server/community-store";
import { auditAdminAction, getAdminOperations } from "@/lib/server/admin-store";
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

        if (type === "post" && id) {
          const community = await deleteCommunityPost(id);
          await auditAdminAction("Post removed", `${id} removed from community history`, admin.user.username);
          return json({ community, operations: await getAdminOperations() });
        }
        if (type === "comment" && id) {
          const community = await deleteCommunityComment(id);
          await auditAdminAction("Comment removed", `${id} removed from community history`, admin.user.username);
          return json({ community, operations: await getAdminOperations() });
        }
        return json({ error: "Bulk history clearing is disabled to protect analytics and accountability." }, { status: 400 });
      },
      GET: async ({ request }: { request: Request }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });
        return json({ community: await getCommunitySnapshot(), operations: await getAdminOperations() });
      },
    },
  },
});
