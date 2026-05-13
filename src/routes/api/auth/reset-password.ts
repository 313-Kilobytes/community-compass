import { createFileRoute } from "@tanstack/react-router";
import { createSession, json, resetPassword, withSession } from "@/lib/server/auth";

export const Route = createFileRoute("/api/auth/reset-password")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { identifier?: unknown; password?: unknown };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        const identifier = typeof body.identifier === "string" ? body.identifier : "";
        const password = typeof body.password === "string" ? body.password : "";
        const result = await resetPassword(identifier, password);
        if ("error" in result) return json({ error: result.error }, { status: 400 });

        const token = await createSession(result.user.userId);
        return withSession(result.user, token);
      },
    },
  },
});
