import { createFileRoute } from "@tanstack/react-router";
import { json, validatePassword } from "@/lib/server/auth";

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

        const password = typeof body.password === "string" ? body.password : "";
        const passwordError = validatePassword(password);
        if (passwordError) return json({ error: passwordError }, { status: 400 });

        return json(
          { error: "Password resets are handled by Supabase Auth. Use the Supabase password recovery flow." },
          { status: 410 },
        );
      },
    },
  },
});
