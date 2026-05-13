import { createFileRoute } from "@tanstack/react-router";
import { listBroadcastsForRegion } from "@/lib/server/admin-store";
import { getUserFromRequest, json } from "@/lib/server/auth";
import { CAPE_TOWN_REGIONS, type CapeTownRegion } from "@/lib/community";

export const Route = createFileRoute("/api/broadcasts")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

        const url = new URL(request.url);
        const requestedRegion = url.searchParams.get("region") as CapeTownRegion | null;
        const region = requestedRegion && CAPE_TOWN_REGIONS.includes(requestedRegion)
          ? requestedRegion
          : (user.currentLocation ?? user.permanentLocation).region;

        return json({ broadcasts: await listBroadcastsForRegion(region), region });
      },
    },
  },
});
