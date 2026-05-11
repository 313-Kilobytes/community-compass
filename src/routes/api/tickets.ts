import { createFileRoute } from "@tanstack/react-router";
import { createTicket, listTicketsForUser, type AdminTicket } from "@/lib/server/admin-store";
import { getUserFromRequest, json } from "@/lib/server/auth";

export const Route = createFileRoute("/api/tickets")({
  // @ts-ignore - server handlers supported by TanStack Start plugin
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
        return json({ tickets: await listTicketsForUser(user.userId) });
      },
      POST: async ({ request }: { request: Request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

        let body: Partial<AdminTicket>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, { status: 400 });
        }

        const result = await createTicket({ userId: user.userId, username: user.username, email: user.email }, body);
        if (result.error || !result.ticket) return json({ error: result.error }, { status: 400 });
        return json({ ticket: result.ticket }, { status: 201 });
      },
    },
  },
});
