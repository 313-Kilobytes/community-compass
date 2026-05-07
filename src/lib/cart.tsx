import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  query: string;
  store: string;
  title: string;
  price: number | null;
  priceText: string | null;
  url: string;
  qty: number;
};

type Ctx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "qty">) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  total: number;
};

const CartCtx = createContext<Ctx>({
  items: [], add: () => {}, remove: () => {}, setQty: () => {}, clear: () => {}, total: 0,
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("cart", JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const add: Ctx["add"] = (i) => setItems((prev) => {
    const ex = prev.find((p) => p.id === i.id);
    if (ex) return prev.map((p) => p.id === i.id ? { ...p, qty: p.qty + 1 } : p);
    return [...prev, { ...i, qty: 1 }];
  });
  const remove: Ctx["remove"] = (id) => setItems((prev) => prev.filter((p) => p.id !== id));
  const setQty: Ctx["setQty"] = (id, qty) => setItems((prev) =>
    qty <= 0 ? prev.filter((p) => p.id !== id) : prev.map((p) => p.id === id ? { ...p, qty } : p)
  );
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);

  return <CartCtx.Provider value={{ items, add, remove, setQty, clear, total }}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);
