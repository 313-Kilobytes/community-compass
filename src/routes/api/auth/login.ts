import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/auth";

export const Route = createFileRoute("/api/auth/login")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { email?: unknown; identifier?: unknown; password?: unknown };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        const email = typeof body.email === "string" ? body.email.trim() : typeof body.identifier === "string" ? body.identifier.trim() : "";
        if (!email) return json({ error: "Email is required." }, { status: 400 });
        const password = typeof body.password === "string" ? body.password : "";
        if (!password) return json({ error: "Password is required." }, { status: 400 });

        return json({
          error: "Use Supabase auth from the frontend; this API no longer creates session cookies.",
        }, { status: 410 });
      },
    },
  },
});
