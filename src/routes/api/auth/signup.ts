import { createFileRoute } from "@tanstack/react-router";
import {
  createSession,
  createUser,
  json,
  validateEmail,
  validateLocation,
  validateName,
  validatePassword,
  validateUsername,
  withSession,
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

        const result = await createUser({
          username: String(body.username).trim(),
          email: String(body.email).trim(),
          password: String(body.password),
          fullName: validateName(body.fullName),
          permanentLocation,
        });

        if (result.error || !result.user) return json({ error: result.error }, { status: 409 });

        const token = await createSession(result.user.userId);
        return withSession(result.user, token, 201);
      },
    },
  },
});
