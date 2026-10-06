import { createContext, useContext, useState, type ReactNode } from "react";
import type { Item } from "./data";

type Ctx = { added: Record<string, Item[]>; add: (slug: string, item: Item) => void };
const StoreCtx = createContext<Ctx>({ added: {}, add: () => {} });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [added, setAdded] = useState<Record<string, Item[]>>({});
  const add = (slug: string, item: Item) => setAdded((a) => ({ ...a, [slug]: [item, ...(a[slug] ?? [])] }));
  return <StoreCtx.Provider value={{ added, add }}>{children}</StoreCtx.Provider>;
}
export const useStore = () => useContext(StoreCtx);

export const toneClass = (t?: string) =>
  t === "success" ? "bg-success/15 text-success" : t === "warning" ? "bg-warning/20 text-warning" : t === "danger" ? "bg-destructive/15 text-destructive" : t === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground";
