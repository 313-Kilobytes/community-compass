import { createFileRoute } from "@tanstack/react-router";
import { CAPE_TOWN_REGIONS, type CapeTownRegion } from "@/lib/community";
import { getUserFromRequest, json } from "@/lib/server/auth";
import { recordCommunityActivity } from "@/lib/server/community-store";

export const Route = createFileRoute("/api/community/activity")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "Sign in to appear as active." }, { status: 401 });

        let body: { region?: unknown };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        if (!CAPE_TOWN_REGIONS.includes(body.region as CapeTownRegion)) {
          return json({ error: "Region is invalid." }, { status: 400 });
        }

        const activeCounts = await recordCommunityActivity(user, body.region as CapeTownRegion);
        return json({ activeCounts });
      },
    },
  },
});
