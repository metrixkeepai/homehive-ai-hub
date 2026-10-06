import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Item } from "./data";
import { supabase } from "@/integrations/supabase/client";

type Profile = { display_name: string | null; avatar_url: string | null; household: string | null };
type Ctx = {
  added: Record<string, Item[]>;
  add: (slug: string, item: Item) => Promise<boolean>;
  remove: (slug: string, id: string) => Promise<void>;
  profile: Profile | null;
  email: string;
  saveProfile: (p: Partial<Profile>) => Promise<boolean>;
};
const StoreCtx = createContext<Ctx>({ added: {}, add: async () => false, remove: async () => {}, profile: null, email: "", saveProfile: async () => false });

type Row = { id: string; section: string; title: string; subtitle: string; fields: unknown; created_at: string };
const toItem = (r: Row): Item => ({
  id: r.id, title: r.title, subtitle: r.subtitle || "Saved",
  status: ["Saved", "primary"], fields: (r.fields as [string, string][]) ?? [], actions: ["Delete"],
  timeline: [[new Date(r.created_at).toLocaleDateString(), "Added by you"]],
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [added, setAdded] = useState<Record<string, Item[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setEmail(u.user.email ?? "");
    const [{ data: rows }, { data: p }] = await Promise.all([
      supabase.from("home_items").select("id,section,title,subtitle,fields,created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("display_name,avatar_url,household").eq("id", u.user.id).maybeSingle(),
    ]);
    const map: Record<string, Item[]> = {};
    (rows ?? []).forEach((r) => { (map[r.section] ??= []).push(toItem(r as Row)); });
    setAdded(map);
    setProfile(p ?? { display_name: null, avatar_url: null, household: null });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async (slug: string, item: Item) => {
    const { data, error } = await supabase.from("home_items")
      .insert({ section: slug, title: item.title.slice(0, 200), subtitle: item.subtitle.slice(0, 500), fields: item.fields })
      .select("id,section,title,subtitle,fields,created_at").single();
    if (error || !data) return false;
    setAdded((a) => ({ ...a, [slug]: [toItem(data as Row), ...(a[slug] ?? [])] }));
    return true;
  };
  const remove = async (slug: string, id: string) => {
    await supabase.from("home_items").delete().eq("id", id);
    setAdded((a) => ({ ...a, [slug]: (a[slug] ?? []).filter((i) => i.id !== id) }));
  };
  const saveProfile = async (p: Partial<Profile>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const { error } = await supabase.from("profiles").upsert({ id: u.user.id, ...profile, ...p, updated_at: new Date().toISOString() });
    if (!error) setProfile((cur) => ({ ...(cur ?? { display_name: null, avatar_url: null, household: null }), ...p }));
    return !error;
  };

  return <StoreCtx.Provider value={{ added, add, remove, profile, email, saveProfile }}>{children}</StoreCtx.Provider>;
}
export const useStore = () => useContext(StoreCtx);

export const toneClass = (t?: string) =>
  t === "success" ? "bg-success/15 text-success" : t === "warning" ? "bg-warning/20 text-warning" : t === "danger" ? "bg-destructive/15 text-destructive" : t === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground";
