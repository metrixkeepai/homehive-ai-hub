import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGrid, Package, ListChecks, MoreHorizontal, Plus, Bell, Search, Menu, ChevronsUpDown, Check, Building2, Home as HomeIcon, PanelLeftClose, PanelLeftOpen, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountNavigation } from "@/components/hv/navigation";
import { useRouterState } from "@tanstack/react-router";
import { AddAnything } from "@/components/hv/AddAnything";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Sera } from "@/components/hv/Sera";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/hv/Logo";
import { sections, homeNav } from "@/components/hv/data";
import { StoreProvider, useStore } from "@/components/hv/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const linkCls = "flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground";
const activeCls = { className: "bg-secondary font-semibold text-foreground" };

function SideNav({ onPick, collapsed = false }: { onPick?: () => void; collapsed?: boolean }) {
  const { current } = useStore();
  const biz = current.type !== "individual";
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [closed, setClosed] = useState<string[]>([]);
  return (
    <nav aria-label={biz ? "Business navigation" : "Individual navigation"} className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
      <Link to="/app" title={homeNav.title} activeOptions={{ exact: true }} activeProps={activeCls} className={linkCls} onClick={onPick}>
        <homeNav.icon className="h-4 w-4 shrink-0" /> {!collapsed && homeNav.title}
      </Link>
      {accountNavigation(biz).map((group) => {
        const active = group.items.some(({ section }) => pathname === `/app/${section.slug}` || pathname.startsWith(`/app/${section.slug}/`));
        const open = !closed.includes(group.label) || active;
        return <div key={group.label} className={collapsed ? "border-t pt-2 mt-2" : "pt-4"}>
          {!collapsed && <Button variant="ghost" aria-expanded={open} onClick={() => setClosed((c) => c.includes(group.label) ? c.filter((l) => l !== group.label) : [...c, group.label])} className="mb-1 h-8 w-full justify-between px-3 text-xs text-muted-foreground"><span>{group.label}</span><ChevronDown className={`transition ${open ? "" : "-rotate-90"}`} /></Button>}
          {(open || collapsed) && group.items.map(({ section: s, label }) => <Link key={s.slug} title={label} to="/app/$section" params={{ section: s.slug }} activeProps={activeCls} className={linkCls} onClick={onPick}><s.icon className="h-4 w-4 shrink-0" />{!collapsed && label}</Link>)}
        </div>;
      })}
    </nav>
  );
}

function AppLayout() {
  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const results = q.trim().length > 1
    ? sections.flatMap((s) => s.items.filter((i) => (i.title + i.subtitle).toLowerCase().includes(q.toLowerCase())).map((i) => ({ s, i }))).slice(0, 8)
    : [];

  return (
    <StoreProvider>
      <div className="flex min-h-screen bg-background">
        <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card py-5 lg:flex ${collapsed ? "w-16 px-2" : "w-64 px-4"}`}>
          {collapsed ? <HomeIcon className="mx-auto h-7 w-7 text-primary" /> : <Logo />}
          <SideNav collapsed={collapsed} />
        </aside>
        {menu && (
          <div className="fixed inset-0 z-40 bg-midnight/50 lg:hidden" onClick={() => setMenu(false)}>
            <aside className="flex h-full w-72 flex-col bg-card px-4 py-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between"><Logo /><Button size="icon" variant="ghost" aria-label="Close menu" onClick={() => setMenu(false)}><X /></Button></div><SideNav onPick={() => setMenu(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur md:px-6">
            <Button aria-label="Open menu" size="icon" variant="outline" className="shrink-0 lg:hidden" onClick={() => setMenu(true)}><Menu /></Button>
            <Button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} size="icon" variant="ghost" className="hidden shrink-0 lg:inline-flex" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
            <WorkspaceSwitcher />
            <div className="relative flex-1">
              <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your home…" className="w-full bg-transparent outline-none" />
              </div>
              {q.trim().length > 1 && (
                <div className="absolute inset-x-0 top-12 rounded-2xl border bg-card p-2 shadow-soft">
                  {results.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matches for “{q}”.</p>}
                  {results.map(({ s, i }) => (
                    <Link key={s.slug + i.id} to="/app/$section/$id" params={{ section: s.slug, id: i.id }} onClick={() => setQ("")} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-secondary">
                      <s.icon className="h-4 w-4 text-primary" /><span className="flex-1">{i.title}</span><span className="text-xs text-muted-foreground">{s.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link to="/app/$section" params={{ section: "notifications" }} aria-label="Notifications" className="relative rounded-full border p-2"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet" /></Link>
            <button onClick={() => setAddOpen(true)} className="hidden items-center gap-2 rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow lg:flex"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add anything</span></button>
            <Avatar />
          </header>
          <Outlet />
        </main>
        <BottomNav onAdd={() => setAddOpen(true)} onMore={() => setMenu(true)} />

        {addOpen && <AddAnything onClose={() => setAddOpen(false)} />}
        <Sera />
        <Toaster />
      </div>
    </StoreProvider>
  );
}

function Avatar() {
  const { profile, email } = useStore();
  const navigate = useNavigate();
  const n = profile?.display_name || email;
  const ini = (n || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const go = (section: string) => section === "__plans" ? navigate({ to: "/app/plans" }) : navigate({ to: "/app/$section", params: { section } });
  const links: [string, string][] = [["My profile", "profile"], ["Plans & vouchers", "__plans"], ["Subscription & billing", "billing"], ["Security", "security"], ["Integrations", "integrations"], ["Notifications", "notifications"], ["Privacy", "privacy"], ["Settings", "settings"], ["Help", "help"]];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold outline-none focus:ring-2 focus:ring-ring">{ini}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate font-semibold">{profile?.display_name || "Your account"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs font-normal capitalize text-primary">{profile?.account_type !== "individual" ? (profile?.org_name || "Organisation") + ` · ${profile?.account_type ?? "individual"}` : "Household · Individual"}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map(([l, s]) => <DropdownMenuItem key={s} onSelect={() => go(s)}>{l}</DropdownMenuItem>)}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onSelect={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceSwitcher() {
  const { workspaces, current, switchWorkspace, createWorkspace } = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"individual" | "business" | "enterprise">("business");
  const Icon = current.type === "individual" ? HomeIcon : Building2;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex max-w-48 items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm font-medium outline-none">
          <Icon className="h-4 w-4 text-primary" /><span className="truncate">{current.name}</span><ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id ?? "personal"} onSelect={() => switchWorkspace(w.id)}>
              <span className="flex-1 truncate">{w.name}<span className="ml-2 text-xs capitalize text-muted-foreground">{w.type}</span></span>
              {w.id === current.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}><Plus className="h-4 w-4" /> New workspace</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/60 p-4" onClick={() => setCreating(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) { toast.error("Enter a name"); return; } if (await createWorkspace(name.trim(), type)) { toast.success(`Switched to ${name}`); setCreating(false); setName(""); } else toast.error("Couldn't create workspace"); }}
            className="w-full max-w-sm space-y-3 rounded-3xl bg-card p-6 shadow-glow">
            <h3 className="font-display text-2xl">New workspace</h3>
            <p className="text-sm text-muted-foreground">Keep a second home, a business or an organisation separate. Each workspace has its own records.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Smile Dental Clinic" className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              {(["individual", "business", "enterprise"] as const).map((t) => <button type="button" key={t} onClick={() => setType(t)} className={`rounded-xl border px-2 py-2 text-xs capitalize ${type === t ? "border-primary bg-primary/10 text-primary" : ""}`}>{t === "individual" ? "Home" : t}</button>)}
            </div>
            <button className="w-full rounded-full bg-aurora py-2.5 text-sm font-semibold text-primary-foreground">Create and switch</button>
          </form>
        </div>
      )}
    </>
  );
}

function BottomNav({ onAdd, onMore }: { onAdd: () => void; onMore: () => void }) {
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground";
  const act = { className: "text-primary font-semibold" };
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <Link to="/app" activeOptions={{ exact: true }} activeProps={act} className={item}><LayoutGrid className="h-5 w-5" />Overview</Link>
      <Link to="/app/$section" params={{ section: "assets" }} activeProps={act} className={item}><Package className="h-5 w-5" />Assets</Link>
      <button onClick={onAdd} aria-label="Add anything" className="flex flex-1 flex-col items-center pb-2"><span className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-aurora text-primary-foreground shadow-glow"><Plus className="h-6 w-6" /></span><span className="mt-0.5 text-[11px] font-semibold">Add</span></button>
      <Link to="/app/$section" params={{ section: "tasks" }} activeProps={act} className={item}><ListChecks className="h-5 w-5" />Tasks</Link>
      <button onClick={onMore} className={item}><MoreHorizontal className="h-5 w-5" />More</button>
    </nav>
  );
}
