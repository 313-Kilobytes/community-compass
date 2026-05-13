import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { AdminBroadcast } from "@/lib/server/admin-store";

export function AlertInbox() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setBroadcasts([]);
      return;
    }

    let alive = true;
    const load = async () => {
      const response = await fetch("/api/broadcasts", { credentials: "include" }).catch(() => null);
      if (!alive || !response?.ok) return;
      const data = (await response.json().catch(() => ({}))) as { broadcasts?: AdminBroadcast[] };
      setBroadcasts(data.broadcasts ?? []);
    };

    void load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [user]);

  const visible = broadcasts.filter((broadcast) => !dismissed.has(broadcast.id)).slice(0, 2);
  if (!user || visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 md:bottom-4">
      {visible.map((broadcast) => (
        <div key={broadcast.id} className="pointer-events-auto rounded-xl border border-destructive/25 bg-card p-3 shadow-elegant">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <BellRing className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{broadcast.type}</div>
                <p className="mt-1 text-xs text-muted-foreground">{broadcast.message}</p>
                <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
                  {broadcast.region} - {new Date(broadcast.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss alert"
              onClick={() => setDismissed((current) => new Set([...current, broadcast.id]))}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
