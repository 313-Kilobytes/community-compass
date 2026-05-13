import { createFileRoute } from "@tanstack/react-router";
import { getAdminOperations, setUserStatus, type AdminUserStatus } from "@/lib/server/admin-store";
import { deleteUser, json, requireSuperAdmin, updateUserRole, type UserRole } from "@/lib/server/auth";

export const Route = createFileRoute("/api/admin/users/$userId")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      PATCH: async ({ request, params }: { request: Request; params: { userId: string } }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });

        let body: { role?: unknown; status?: unknown };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        let userResult;
        if (body.role) {
          userResult = await updateUserRole(params.userId, body.role as UserRole);
          if (userResult.error || !userResult.user) return json({ error: userResult.error }, { status: 400 });
        }
        if (body.status) {
          const statusResult = await setUserStatus(params.userId, body.status as AdminUserStatus, admin.user.username);
          if (statusResult.error) return json({ error: statusResult.error }, { status: 400 });
        }
        return json({ user: userResult?.user, operations: await getAdminOperations() });
      },
      DELETE: async ({ request, params }: { request: Request; params: { userId: string } }) => {
        const admin = await requireSuperAdmin(request);
        if ("error" in admin) return json({ error: admin.error }, { status: admin.status });
        if (admin.user.userId === params.userId) return json({ error: "You cannot delete your own admin account." }, { status: 400 });

        const result = await deleteUser(params.userId);
        if (result.error) return json({ error: result.error }, { status: 400 });
        return json({ ok: true });
      },
    },
  },
});
