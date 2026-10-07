import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Item } from "./data";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  display_name: string | null; avatar_url: string | null; household: string | null;
  account_type: "individual" | "business" | "enterprise"; plan: string; plan_source: string | null; business_type: string | null; org_size: string | null; branches: number | null; trial_ends_at: string | null; org_name: string | null; sector: string | null; job_title: string | null;
  phone: string | null; language: string; currency: string; timezone: string; bio: string | null;
};
const emptyProfile: Profile = { display_name: null, avatar_url: null, household: null, account_type: "individual", org_name: null, sector: null, job_title: null, phone: null, language: "English (UK)", currency: "GBP", timezone: "Europe/London", bio: null, plan: "free", plan_source: null, business_type: null, org_size: null, branches: null, trial_ends_at: null };
export type Workspace = { id: string | null; name: string; type: "individual" | "business" | "enterprise" };
type Ctx = {
  added: Record<string, Item[]>;
  add: (slug: string, item: Item) => Promise<boolean>;
  addReturning: (slug: string, item: Item) => Promise<string | null>;
  remove: (slug: string, id: string) => Promise<void>;
  update: (id: string, item: Item) => Promise<boolean>;
  profile: Profile | null;
  email: string;
  saveProfile: (p: Partial<Profile>) => Promise<boolean>;
  workspaces: Workspace[];
  current: Workspace;
  switchWorkspace: (id: string | null) => void;
  createWorkspace: (name: string, type: Workspace["type"]) => Promise<boolean>;
  reload: () => Promise<void>;
};
const personal: Workspace = { id: null, name: "Personal", type: "individual" };
const StoreCtx = createContext<Ctx>({ added: {}, add: async () => false, addReturning: async () => null, remove: async () => {}, update: async () => false, profile: null, email: "", saveProfile: async () => false, workspaces: [], current: { id: null, name: "Personal", type: "individual" }, switchWorkspace: () => {}, createWorkspace: async () => false, reload: async () => {} });

type Row = { id: string; workspace_id?: string | null; section: string; title: string; subtitle: string; fields: unknown; created_at: string };
const toItem = (r: Row): Item => ({
  id: r.id, title: r.title, subtitle: r.subtitle || "Saved",
  status: ["Saved", "primary"], fields: (r.fields as [string, string][]) ?? [], actions: ["Delete"],
  timeline: [[new Date(r.created_at).toLocaleDateString(), "Added by you"]],
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [added, setAdded] = useState<Record<string, Item[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [rawWs, setRawWs] = useState<Workspace[]>([]);
  const [wsId, setWsId] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<Row[]>([]);
  useEffect(() => { setWsId(localStorage.getItem("hv-ws") || null); }, []);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setEmail(u.user.email ?? "");
    const [{ data: rows }, { data: p }, { data: ws }] = await Promise.all([
      supabase.from("home_items").select("id,workspace_id,section,title,subtitle,fields,created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("display_name,avatar_url,household,account_type,org_name,sector,job_title,phone,language,currency,timezone,bio,plan,plan_source,business_type,org_size,branches,trial_ends_at").eq("id", u.user.id).maybeSingle(),
      supabase.from("workspaces").select("id,name,type").order("created_at"),
    ]);
    setAllRows((rows ?? []) as Row[]);
    setRawWs((ws ?? []) as Workspace[]);
    setProfile(p ? { ...emptyProfile, ...(p as Partial<Profile>) } : emptyProfile);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const personalWs: Workspace = profile && profile.account_type !== "individual"
    ? { id: null, name: profile.org_name || "My organisation", type: profile.account_type } : personal;
  const workspaces = [personalWs, ...rawWs];
  const current = workspaces.find((w) => w.id === wsId) ?? personalWs;
  useEffect(() => {
    const map: Record<string, Item[]> = {};
    allRows.filter((r) => (r.workspace_id ?? null) === current.id).forEach((r) => { (map[r.section] ??= []).push(toItem(r)); });
    setAdded(map);
  }, [allRows, current.id]);
  const switchWorkspace = (id: string | null) => { setWsId(id); if (id) localStorage.setItem("hv-ws", id); else localStorage.removeItem("hv-ws"); };
  const createWorkspace = async (name: string, type: Workspace["type"]) => {
    const { data, error } = await supabase.from("workspaces").insert({ name: name.slice(0, 120), type }).select("id,name,type").single();
    if (error || !data) return false;
    setRawWs((w) => [...w, data as Workspace]); switchWorkspace(data.id); return true;
  };

  const add = async (slug: string, item: Item): Promise<boolean> => (await addReturning(slug, item)) !== null;
  const addReturning = async (slug: string, item: Item): Promise<string | null> => {
    const { data, error } = await supabase.from("home_items")
      .insert({ workspace_id: current.id, section: slug, title: item.title.slice(0, 200), subtitle: item.subtitle.slice(0, 500), fields: item.fields })
      .select("id,workspace_id,section,title,subtitle,fields,created_at").single();
    if (error || !data) return null;
    setAllRows((r) => [data as Row, ...r]);
    return data.id;
  };
  const remove = async (slug: string, id: string) => {
    const { error } = await supabase.from("home_items").delete().eq("id", id);
    if (error) throw error;
    setAllRows((r) => r.filter((x) => x.id !== id)); void slug;
  };
  const update = async (id: string, item: Item) => {
    const { data, error } = await supabase.from("home_items").update({ title: item.title.slice(0, 200), subtitle: item.subtitle.slice(0, 500), fields: item.fields }).eq("id", id).select("id,workspace_id,section,title,subtitle,fields,created_at").single();
    if (error || !data) return false;
    setAllRows((rows) => rows.map((row) => row.id === id ? data as Row : row));
    return true;
  };
  const saveProfile = async (p: Partial<Profile>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const { error } = await supabase.from("profiles").upsert({ id: u.user.id, ...(profile ?? {}), ...p, updated_at: new Date().toISOString() });
    if (!error) setProfile((cur) => ({ ...(cur ?? emptyProfile), ...p }));
    return !error;
  };

  return <StoreCtx.Provider value={{ added, add, addReturning, remove, update, profile, email, saveProfile, workspaces, current, switchWorkspace, createWorkspace, reload: load }}>{children}</StoreCtx.Provider>;
}
export const useStore = () => useContext(StoreCtx);

export const toneClass = (t?: string) =>
  t === "success" ? "bg-success/15 text-success" : t === "warning" ? "bg-warning/20 text-warning" : t === "danger" ? "bg-destructive/15 text-destructive" : t === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground";
