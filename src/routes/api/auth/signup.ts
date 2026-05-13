import { createFileRoute } from "@tanstack/react-router";
import {
  json,
  validateEmail,
  validateLocation,
  validatePassword,
  validateUsername,
} from "@/lib/server/auth";

export const Route = createFileRoute("/api/auth/signup")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: {
          username?: unknown;
          email?: unknown;
          password?: unknown;
          fullName?: unknown;
          permanentLocation?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        const usernameError = validateUsername(body.username);
        if (usernameError) return json({ error: usernameError }, { status: 400 });

        const emailError = validateEmail(body.email);
        if (emailError) return json({ error: emailError }, { status: 400 });

        const passwordError = validatePassword(body.password);
        if (passwordError) return json({ error: passwordError }, { status: 400 });

        const permanentLocation = validateLocation(body.permanentLocation);
        if (!permanentLocation) return json({ error: "Permanent location is required." }, { status: 400 });

        return json({
          error: "Use Supabase auth from the frontend; this API no longer creates session cookies.",
        }, { status: 410 });
      },
    },
  },
});
