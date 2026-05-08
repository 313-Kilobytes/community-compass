import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Search,
  BarChart3,
  MessageCircle,
  Sparkles,
  Siren,
  ShoppingBasket,
  ShoppingCart,
  Newspaper,
} from "lucide-react";
import { useT } from "@/lib/i18n";

const items = [
  { title: "nav.resources" as const, url: "/", icon: LayoutGrid },
  { title: "nav.feed" as const, url: "/feed", icon: Newspaper },
  { title: "nav.groceries" as const, url: "/groceries", icon: ShoppingBasket },
  { title: "nav.cart" as const, url: "/cart", icon: ShoppingCart },
  { title: "nav.availability" as const, url: "/availability", icon: Search },
  { title: "nav.emergency" as const, url: "/emergency", icon: Siren },
  { title: "nav.insights" as const, url: "/insights", icon: BarChart3 },
  { title: "nav.assistant" as const, url: "/chat", icon: MessageCircle },
  { title: "nav.profile" as const, url: "/profile", icon: UserRound },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();

  return (
    <aside className="relative hidden w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px 300px at -20% -20%, color-mix(in oklab, var(--sidebar-primary) 35%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-center gap-3 border-b border-sidebar-border px-5 py-6">
        <div
          className="h-10 w-10 rounded-xl grid place-items-center shadow-glow"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-display font-semibold text-base leading-tight">CommunityHub</div>
          <div className="text-[11px] text-sidebar-foreground/60 tracking-wide uppercase">
            Crisis Intel
          </div>
        </div>
      </div>
      <nav className="relative flex-1 p-3 space-y-1">
        {items.map((it) => {
          const active = pathname === it.url;
          return (
            <Link
              key={it.url}
              to={it.url}
              className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                active
                  ? "border-sidebar-primary/25 bg-sidebar-primary/12 text-sidebar-foreground"
                  : "border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <span
                className={`h-8 w-8 grid place-items-center rounded-md transition-colors ${
                  active
                    ? "bg-sidebar-primary/25 text-sidebar-foreground"
                    : "bg-sidebar-accent/40 text-sidebar-foreground/70 group-hover:bg-sidebar-accent"
                }`}
              >
                <it.icon className="h-4 w-4" />
              </span>
              <span className="font-medium">{t(it.title)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="relative p-4 m-3 rounded-xl bg-sidebar-accent/40 border border-sidebar-border">
        <div className="text-xs font-semibold text-sidebar-foreground/90">AI crisis hub</div>
        <div className="text-[11px] text-sidebar-foreground/60 mt-0.5">
          Alerts, resources, feed, and recommendations.
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();

  return (
    <nav className="md:hidden fixed bottom-3 inset-x-3 glass border border-border rounded-2xl shadow-elegant flex gap-1 overflow-x-auto py-2 px-2 z-50">
      {items.map((it) => {
        const active = pathname === it.url;
        return (
          <Link
            key={it.url}
            to={it.url}
            className={`flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
              active ? "bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
          >
            <it.icon className="h-5 w-5" />
            {t(it.title)}
          </Link>
        );
      })}
    </nav>
  );
}
