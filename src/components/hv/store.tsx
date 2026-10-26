import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Item } from "./data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { planByKey } from "@/lib/plans";
import { checkAdd, effective, type Entitlements } from "@/lib/entitlements";
import { fetchPublished, openUpgrade, UpgradeModal } from "./Upgrade";
import { editableProfilePatch } from "@/lib/profile";

/** Plan capacity for a section, or null when the plan doesn't cap it. */
export function sectionLimit(
  slug: string,
  plan?: string | null,
): { max: number; label: string } | null {
  const l = planByKey(plan).limits;
  const m: Record<string, [number, string]> = {
    assets: [l.assets, "assets"],
    documents: [l.docs, "documents"],
    locations: [l.places, "locations"],
    properties: [l.places, "properties"],
    team: [l.users, "team members"],
  };
  const v = m[slug];
  return v && Number.isFinite(v[0]) ? { max: v[0], label: v[1] } : null;
}

export type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  household: string | null;
  account_type: "individual" | "business" | "enterprise";
  plan: string;
  plan_source: string | null;
  business_type: string | null;
  org_size: string | null;
  branches: number | null;
  trial_ends_at: string | null;
  org_name: string | null;
  sector: string | null;
  job_title: string | null;
  phone: string | null;
  language: string;
  currency: string;
  timezone: string;
  country: string;
  bio: string | null;
};
const emptyProfile: Profile = {
  display_name: null,
  avatar_url: null,
  household: null,
  account_type: "individual",
  org_name: null,
  sector: null,
  job_title: null,
  phone: null,
  language: "English (UK)",
  currency: "GBP",
  timezone: "Europe/London",
  country: "United Kingdom",
  bio: null,
  plan: "free",
  plan_source: null,
  business_type: null,
  org_size: null,
  branches: null,
  trial_ends_at: null,
};
export type Workspace = {
  id: string | null;
  name: string;
  type: "individual" | "business" | "enterprise";
};
/** Sections that store property/location records (not child inventory). */
export const PROPERTY_SLUGS: readonly string[] = ["my-home", "locations"];

export const isArchivedItem = (item: Item) =>
  item.fields.some(([k, v]) => k === "Status" && /^(archived|superseded)$/i.test(v));

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
  findRecord: (section: string, id: string) => Promise<Item | null>;
  searchRecords: (text: string) => Promise<{ section: string; item: Item }[]>;
  /** Active property section for the current account type. */
  propertySlug: "my-home" | "locations";
  /** Property/location records from the backend for the current workspace. */
  properties: Item[];
};
const personal: Workspace = { id: null, name: "Personal", type: "individual" };
const StoreCtx = createContext<Ctx>({
  added: {},
  add: async () => false,
  addReturning: async () => null,
  remove: async () => {},
  update: async () => false,
  profile: null,
  email: "",
  saveProfile: async () => false,
  workspaces: [],
  current: { id: null, name: "Personal", type: "individual" },
  switchWorkspace: () => {},
  createWorkspace: async () => false,
  reload: async () => {},
  findRecord: async () => null,
  searchRecords: async () => [],
  propertySlug: "my-home",
  properties: [],
});

type Row = {
  id: string;
  workspace_id?: string | null;
  property_id?: string | null;
  section: string;
  title: string;
  subtitle: string;
  fields: unknown;
  created_at: string;
};
const ROW_SELECT = "id,workspace_id,property_id,section,title,subtitle,fields,created_at";
const toItem = (r: Row): Item => ({
  id: r.id,
  title: r.title,
  subtitle: r.subtitle || "Saved",
  status: ["Saved", "primary"],
  fields: (r.fields as [string, string][]) ?? [],
  propertyId: r.property_id ?? null,
  actions: ["Delete"],
  timeline: [[new Date(r.created_at).toLocaleDateString(), "Added by you"]],
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [added, setAdded] = useState<Record<string, Item[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [rawWs, setRawWs] = useState<Workspace[]>([]);
  const [wsId, setWsId] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const loadSequence = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<Row | null>(null);
  const [published, setPublished] = useState<Record<string, Entitlements>>({});
  useEffect(() => {
    void fetchPublished()
      .then(setPublished)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setWsId(localStorage.getItem("hv-ws") || null);
  }, []);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setEmail(u.user.email ?? "");
    let query = supabase.from("home_items").select(ROW_SELECT).eq("user_id", u.user.id);
    query = wsId ? query.eq("workspace_id", wsId) : query.is("workspace_id", null);
    const [records, { data: p, error: profileError }, { data: ws, error: workspaceError }] =
      await Promise.all([
        query.order("created_at", { ascending: false }).order("id").range(0, 499),
        supabase
          .from("profiles")
          .select(
            "display_name,avatar_url,household,account_type,org_name,sector,job_title,phone,language,currency,timezone,country,bio,plan,plan_source,business_type,org_size,branches,trial_ends_at",
          )
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("workspaces").select("id,name,type").order("created_at"),
      ]);
    if (sequence !== loadSequence.current) return;
    if (workspaceError || profileError) {
      toast.error("Workspace details could not be loaded. Please retry.");
      return;
    }
    // A saved selection can outlive a deleted workspace or belong to a previous account.
    // Reset the query scope as well as the displayed workspace, then reload personal records.
    if (wsId && !(ws ?? []).some((workspace) => workspace.id === wsId)) {
      ++loadSequence.current;
      setAllRows([]);
      setAdded({});
      setHasMore(false);
      cursor.current = null;
      setRawWs((ws ?? []) as Workspace[]);
      setWsId(null);
      localStorage.removeItem("hv-ws");
      return;
    }
    if (records.error) {
      toast.error("Workspace records could not be loaded.");
      return;
    }
    const rows = records.data;
    setHasMore(rows.length === 500);
    cursor.current = (rows.at(-1) as Row | undefined) ?? null;
    setAllRows((rows ?? []) as Row[]);
    setRawWs((ws ?? []) as Workspace[]);
    setProfile(p ? { ...emptyProfile, ...(p as Partial<Profile>) } : emptyProfile);
  }, [wsId]);

  useEffect(() => {
    void load();
  }, [load]);

  const findRecord = useCallback(
    async (section: string, id: string) => {
      const sequence = loadSequence.current;
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in to load records");
      let query = supabase
        .from("home_items")
        .select(ROW_SELECT)
        .eq("user_id", auth.user.id)
        .eq("id", id)
        .eq("section", section);
      query = wsId ? query.eq("workspace_id", wsId) : query.is("workspace_id", null);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error("Record could not be loaded");
      if (sequence !== loadSequence.current || !data) return null;
      setAllRows((rows) => (rows.some((r) => r.id === id) ? rows : [...rows, data as Row]));
      return toItem(data as Row);
    },
    [wsId],
  );
  const searchRecords = useCallback(
    async (text: string) => {
      const words = text.match(/[\p{L}\p{N}]{2,30}/gu)?.slice(0, 5) ?? [];
      if (!words.length) return [];
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in to search records");
      let query = supabase.from("home_items").select(ROW_SELECT).eq("user_id", auth.user.id);
      query = wsId ? query.eq("workspace_id", wsId) : query.is("workspace_id", null);
      for (const word of words) query = query.or(`title.ilike.%${word}%,subtitle.ilike.%${word}%`);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(20);
      if (error) throw new Error("Search is temporarily unavailable");
      return (data ?? []).map((row) => ({ section: row.section, item: toItem(row as Row) }));
    },
    [wsId],
  );

  const personalWs: Workspace =
    profile && profile.account_type !== "individual"
      ? { id: null, name: profile.org_name || "My organisation", type: profile.account_type }
      : personal;
  const workspaces = [personalWs, ...rawWs];
  const current = workspaces.find((w) => w.id === wsId) ?? personalWs;
  const propertySlug: "my-home" | "locations" =
    current.type === "individual" ? "my-home" : "locations";
  useEffect(() => {
    const map: Record<string, Item[]> = {};
    allRows
      .filter((r) => (r.workspace_id ?? null) === current.id)
      .forEach((r) => {
        (map[r.section] ??= []).push(toItem(r));
      });
    setAdded(map);
  }, [allRows, current.id]);
  const properties = added[propertySlug] ?? [];
  const switchWorkspace = (id: string | null) => {
    ++loadSequence.current;
    setAllRows([]);
    setAdded({});
    setWsId(id);
    if (id) localStorage.setItem("hv-ws", id);
    else localStorage.removeItem("hv-ws");
  };
  const createWorkspace = async (name: string, type: Workspace["type"]) => {
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: name.slice(0, 120), type })
      .select("id,name,type")
      .single();
    if (error || !data) return false;
    setRawWs((w) => [...w, data as Workspace]);
    switchWorkspace(data.id);
    return true;
  };

  const loadMore = async () => {
    if (loadingMore || !cursor.current) return;
    const sequence = loadSequence.current;
    const last = cursor.current;
    setLoadingMore(true);
    let query = supabase.from("home_items").select(ROW_SELECT);
    query = wsId ? query.eq("workspace_id", wsId) : query.is("workspace_id", null);
    const { data, error } = await query
      .or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.gt.${last.id})`)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(500);
    if (sequence === loadSequence.current) {
      if (error) toast.error("Older records could not be loaded.");
      else {
        const rows = (data ?? []) as Row[];
        setAllRows((old) => [...old, ...rows.filter((row) => !old.some((x) => x.id === row.id))]);
        cursor.current = rows.at(-1) ?? null;
        setHasMore(rows.length === 500);
      }
    }
    setLoadingMore(false);
  };

  const add = async (slug: string, item: Item): Promise<boolean> =>
    (await addReturning(slug, item)) !== null;
  const addReturning = async (slug: string, item: Item): Promise<string | null> => {
    const plan = profile?.plan ?? "free";
    const gate = checkAdd(
      effective(plan, published[plan]),
      slug,
      allRows.filter((r) => r.section === slug).length,
    );
    if (!gate.ok) {
      openUpgrade(gate);
      return null;
    }
    const { data, error } = await supabase
      .from("home_items")
      .insert({
        workspace_id: current.id,
        section: slug,
        title: item.title.slice(0, 200),
        subtitle: item.subtitle.slice(0, 500),
        fields: item.fields,
        property_id: item.propertyId ?? null,
      })
      .select(ROW_SELECT)
      .single();
    if (error || !data) return null;
    setAllRows((r) => [data as Row, ...r]);
    return data.id;
  };
  const remove = async (slug: string, id: string) => {
    const { error } = await supabase.from("home_items").delete().eq("id", id);
    if (error) throw error;
    setAllRows((r) => r.filter((x) => x.id !== id));
    void slug;
  };
  const update = async (id: string, item: Item) => {
    const { data, error } = await supabase
      .from("home_items")
      .update({
        title: item.title.slice(0, 200),
        subtitle: item.subtitle.slice(0, 500),
        fields: item.fields,
        ...(item.propertyId !== undefined ? { property_id: item.propertyId } : {}),
      })
      .eq("id", id)
      .select(ROW_SELECT)
      .single();
    if (error || !data) return false;
    setAllRows((rows) => rows.map((row) => (row.id === id ? (data as Row) : row)));
    return true;
  };
  const saveProfile = async (p: Partial<Profile>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const patch = editableProfilePatch(p);
    if (Object.keys(patch).length !== Object.keys(p).length) return false;
    const { error } = await supabase
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", u.user.id);
    if (!error) setProfile((cur) => ({ ...(cur ?? emptyProfile), ...patch }));
    return !error;
  };

  return (
    <StoreCtx.Provider
      value={{
        added,
        add,
        addReturning,
        remove,
        update,
        profile,
        email,
        saveProfile,
        workspaces,
        current,
        switchWorkspace,
        createWorkspace,
        reload: load,
        findRecord,
        searchRecords,
        propertySlug,
        properties,
      }}
    >
      {children}
      {hasMore && (
        <div className="border-t bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">
            More records are saved in this workspace. Section counts reflect loaded records. Global
            search covers the workspace.
          </p>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-2 rounded-full border px-5 py-3"
          >
            {loadingMore ? "Loading…" : "Load older records"}
          </button>
        </div>
      )}
      <UpgradeModal />
    </StoreCtx.Provider>
  );
}
export const useStore = () => useContext(StoreCtx);

export const toneClass = (t?: string) =>
  t === "success"
    ? "bg-success/15 text-success"
    : t === "warning"
      ? "bg-warning/20 text-warning"
      : t === "danger"
        ? "bg-destructive/15 text-destructive"
        : t === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-muted-foreground";
