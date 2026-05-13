import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/auth";

export const Route = createFileRoute("/api/auth/logout")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async () => json({ ok: true }),
    },
  },
});
