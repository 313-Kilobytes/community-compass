import { createFileRoute } from "@tanstack/react-router";
import { getCommunitySnapshot, saveCommunitySnapshot } from "@/lib/server/community-store";
import { json } from "@/lib/server/auth";

export const Route = createFileRoute("/api/community")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      GET: async () => {
        return json(await getCommunitySnapshot());
      },
      PUT: async ({ request }: { request: Request }) => {
        let body: { posts?: unknown; chatSessions?: unknown; areaComments?: unknown };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        return json(await saveCommunitySnapshot(body));
      },
    },
  },
});
