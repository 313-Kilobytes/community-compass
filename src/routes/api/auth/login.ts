import { createFileRoute } from "@tanstack/react-router";
import { authenticate, createSession, json, withSession } from "@/lib/server/auth";

export const Route = createFileRoute("/api/auth/login")({
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

        const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
        if (!identifier) return json({ error: "Email or username is required." }, { status: 400 });

        const password = typeof body.password === "string" ? body.password : "";
        if (!password) return json({ error: "Password is required." }, { status: 400 });

        const result = await authenticate(identifier, password);
        if (result.error || !result.user) return json({ error: result.error }, { status: 401 });

        const token = await createSession(result.user.userId);
        return withSession(result.user, token);
      },
    },
  },
});
