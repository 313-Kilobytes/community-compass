import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingCart, Trash2, Mail, ExternalLink, Minus, Plus, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart - Community Compass" },
      { name: "description", content: "Your saved grocery list. Share it via email." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { t } = useT();
  const { items, remove, setQty, clear, total } = useCart();
  const [email, setEmail] = useState("");

  const buildBody = () => {
    const lines = items.map((i) => `• ${i.qty}× ${i.title} — ${i.store} ${i.priceText ?? ""}\n  ${i.url}`).join("\n\n");
    const sum = total > 0 ? `\n\n${t("cart.totalEst")}: R${total.toFixed(2)}` : "";
    return `${t("cart.emailIntro")}\n\n${lines}${sum}\n\n- Community Compass`;
  };

  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(t("cart.emailSubject"))}&body=${encodeURIComponent(buildBody())}`;

  return (
    <div className="px-4 md:px-10 py-8 md:py-10 max-w-4xl mx-auto">
      <Link to="/groceries" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> {t("cart.back")}
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-2xl grid place-items-center shadow-glow" style={{ background: "var(--gradient-primary)" }}>
          <ShoppingCart className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">{t("cart.title")}</h1>
          <p className="text-sm text-muted-foreground">{items.length} {t("cart.items")}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
          <p className="text-muted-foreground mb-4">{t("cart.empty")}</p>
          <Link to="/groceries" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground shadow-elegant" style={{ background: "var(--gradient-primary)" }}>
            {t("cart.startShopping")}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            {items.map((i) => (
              <div key={i.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{i.store}</div>
                  <div className="font-medium text-sm truncate">{i.title}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{i.priceText ?? "—"}</div>
                </div>
                <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
                  <button onClick={() => setQty(i.id, i.qty - 1)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-background"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{i.qty}</span>
                  <button onClick={() => setQty(i.id, i.qty + 1)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-background"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <a href={i.url} target="_blank" rel="noreferrer noopener" className="h-8 w-8 grid place-items-center rounded-lg bg-secondary hover:bg-secondary/80"><ExternalLink className="h-4 w-4" /></a>
                <button onClick={() => remove(i.id)} className="h-8 w-8 grid place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 mb-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("cart.totalEst")}</span>
            <span className="text-2xl font-bold tabular-nums">R{total.toFixed(2)}</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">{t("cart.shareTitle")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{t("cart.shareSub")}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <a
                href={mailto}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-primary-foreground text-sm font-semibold shadow-elegant hover:opacity-95"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Mail className="h-4 w-4" /> {t("cart.send")}
              </a>
            </div>
            <button onClick={clear} className="mt-4 text-xs text-destructive hover:underline">{t("cart.clear")}</button>
          </div>
        </>
      )}
    </div>
  );
}
