import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Search, BarChart3, MessageCircle, HeartHandshake } from "lucide-react";

const items = [
  { title: "Resources", url: "/", icon: LayoutGrid },
  { title: "Availability", url: "/availability", icon: Search },
  { title: "Insights", url: "/insights", icon: BarChart3 },
  { title: "Assistant", url: "/chat", icon: MessageCircle },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold leading-tight">CommunityHub</div>
          <div className="text-xs text-sidebar-foreground/60">Resource Intelligence</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const active = pathname === it.url;
          return (
            <Link
              key={it.url}
              to={it.url}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <it.icon className="h-4 w-4" />
              {it.title}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-xs text-sidebar-foreground/50 border-t border-sidebar-border">
        Local-first · Cached · Lightweight
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-sidebar text-sidebar-foreground border-t border-sidebar-border flex justify-around py-2 z-50">
      {items.map((it) => {
        const active = pathname === it.url;
        return (
          <Link
            key={it.url}
            to={it.url}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
              active ? "text-sidebar-primary" : "text-sidebar-foreground/70"
            }`}
          >
            <it.icon className="h-5 w-5" />
            {it.title}
          </Link>
        );
      })}
    </nav>
  );
}
