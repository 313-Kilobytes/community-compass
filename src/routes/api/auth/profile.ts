import { createFileRoute } from "@tanstack/react-router";
import {
  getUserFromRequest,
  json,
  updateUserProfile,
  validateLocation,
  validateName,
  validateProfilePicture,
  validateUsername,
} from "@/lib/server/auth";

export const Route = createFileRoute("/api/auth/profile")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
        return json({ user });
      },
      PUT: async ({ request }: { request: Request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

        let body: {
          username?: unknown;
          fullName?: unknown;
          currentLocation?: unknown;
          permanentLocation?: unknown;
          changePermanentLocation?: unknown;
          profilePicture?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        if (body.username !== undefined) {
          const usernameError = validateUsername(body.username);
          if (usernameError) return json({ error: usernameError }, { status: 400 });
        }

        const currentLocation =
          body.currentLocation === null
            ? null
            : body.currentLocation === undefined
              ? undefined
              : validateLocation(body.currentLocation);
        if (body.currentLocation !== undefined && body.currentLocation !== null && !currentLocation) {
          return json({ error: "Current location is invalid." }, { status: 400 });
        }

        const permanentLocation = body.changePermanentLocation ? validateLocation(body.permanentLocation) : undefined;
        if (body.changePermanentLocation && !permanentLocation) {
          return json({ error: "Permanent location is invalid." }, { status: 400 });
        }

        const result = await updateUserProfile(user.userId, {
          username: typeof body.username === "string" ? body.username.trim() : undefined,
          fullName: validateName(body.fullName),
          currentLocation,
          permanentLocation: permanentLocation ?? undefined,
          profilePicture: validateProfilePicture(body.profilePicture),
        });

        if (result.error || !result.user) return json({ error: result.error }, { status: 409 });
        return json({ user: result.user });
      },
    },
  },
});
