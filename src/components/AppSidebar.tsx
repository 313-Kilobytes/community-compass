import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Compass,
  LayoutGrid,
  Menu,
  Siren,
  ShoppingBasket,
  Newspaper,
  UserRound,
  ShieldCheck,
  PackageCheck,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const items = [
  { title: "nav.resources" as const, url: "/", icon: LayoutGrid },
  { title: "nav.feed" as const, url: "/feed", icon: Newspaper },
  { title: "nav.availability" as const, url: "/availability", icon: PackageCheck },
  { title: "nav.groceries" as const, url: "/groceries", icon: ShoppingBasket },
  { title: "nav.emergency" as const, url: "/emergency", icon: Siren },
  { title: "nav.insights" as const, url: "/insights", icon: BarChart3 },
  { title: "nav.profile" as const, url: "/profile", icon: UserRound },
];

const adminItem = { title: "nav.admin" as const, url: "/admin", icon: ShieldCheck };
type SidebarItem = (typeof items)[number] | typeof adminItem;

export function AppSidebar() {
  return null;
}

export function MenuNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();
  const { user } = useAuth();
  const visibleItems = user?.role === "super_admin" ? [...items, adminItem] : items;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed left-3 top-3 z-50 grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-foreground shadow-card"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(88vw,340px)] overflow-hidden border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:right-3 [&>button]:top-3 [&>button]:grid [&>button]:h-10 [&>button]:w-10 [&>button]:place-items-center [&>button]:rounded-xl [&>button]:bg-sidebar-accent [&>button]:text-sidebar-foreground [&>button]:opacity-100 [&>button]:shadow-card [&>button:hover]:bg-sidebar-primary/15"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent pathname={pathname} visibleItems={visibleItems} t={t} closeOnNavigate />
      </SheetContent>
    </Sheet>
  );
}

function SidebarContent({
  pathname,
  visibleItems,
  t,
  closeOnNavigate = false,
}: {
  pathname: string;
  visibleItems: SidebarItem[];
  t: (key: SidebarItem["title"]) => string;
  closeOnNavigate?: boolean;
}) {
  return (
    <>
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px 300px at -20% -20%, color-mix(in oklab, var(--sidebar-primary) 35%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-center gap-3 border-b border-sidebar-border px-5 py-6">
        <div
          className="h-10 w-10 rounded-lg grid place-items-center shadow-glow"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Compass className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-display font-semibold text-base leading-tight">Community Compass</div>
          <div className="text-[11px] text-sidebar-foreground/60 tracking-wide uppercase">Local resource network</div>
        </div>
      </div>

      <nav className="relative flex-1 p-3 space-y-1">
        {visibleItems.map((it) => {
          const active = pathname === it.url;
          const link = (
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
          return closeOnNavigate ? (
            <SheetClose key={it.url} asChild>
              {link}
            </SheetClose>
          ) : (
            link
          );
        })}
      </nav>
    </>
  );
}

