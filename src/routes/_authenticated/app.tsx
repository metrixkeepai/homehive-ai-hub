import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Bell, Search, Camera, Receipt, Mic, Upload, Mail, X, DoorOpen, Menu } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Logo } from "@/components/hv/Logo";
import { sections, homeNav } from "@/components/hv/data";
import { StoreProvider } from "@/components/hv/store";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const linkCls = "flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground";
const activeCls = { className: "bg-secondary font-semibold text-foreground" };

function SideNav({ onPick }: { onPick?: () => void }) {
  return (
    <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
      <Link to="/app" activeOptions={{ exact: true }} activeProps={activeCls} className={linkCls} onClick={onPick}>
        <homeNav.icon className="h-4 w-4" /> {homeNav.title}
      </Link>
      {(["main", "account"] as const).map((g) => (
        <div key={g}>
          {g === "account" && <p className="mt-5 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</p>}
          {sections.filter((s) => s.group === g).map((s) => (
            <Link key={s.slug} to="/app/$section" params={{ section: s.slug }} activeProps={activeCls} className={linkCls} onClick={onPick}>
              <s.icon className="h-4 w-4" /> {s.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function AppLayout() {
  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const results = q.trim().length > 1
    ? sections.flatMap((s) => s.items.filter((i) => (i.title + i.subtitle).toLowerCase().includes(q.toLowerCase())).map((i) => ({ s, i }))).slice(0, 8)
    : [];

  const addTargets: [typeof Camera, string, string][] = [
    [Camera, "Take photo", "assets"], [DoorOpen, "Scan room", "rooms"], [Receipt, "Scan receipt", "documents"],
    [Upload, "Upload document", "documents"], [Mic, "Speak", "tasks"], [Mail, "Import email", "integrations"],
  ];

  return (
    <StoreProvider>
      <div className="flex min-h-screen bg-background">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card px-4 py-5 lg:flex">
          <Logo />
          <SideNav />
        </aside>
        {menu && (
          <div className="fixed inset-0 z-40 bg-midnight/50 lg:hidden" onClick={() => setMenu(false)}>
            <aside className="flex h-full w-72 flex-col bg-card px-4 py-5" onClick={(e) => e.stopPropagation()}>
              <Logo /><SideNav onPick={() => setMenu(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur md:px-6">
            <button aria-label="Open menu" className="rounded-full border p-2 lg:hidden" onClick={() => setMenu(true)}><Menu className="h-4 w-4" /></button>
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
            <Link to="/app/$section" params={{ section: "profile" }} aria-label="My profile" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold">SM</Link>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add anything</span></button>
          </header>
          <Outlet />
        </main>

        {addOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/60 p-4 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
            <div className="animate-rise w-full max-w-lg rounded-3xl bg-card p-7 shadow-glow" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl">Add anything</h3>
                <button aria-label="Close" onClick={() => setAddOpen(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {addTargets.map(([Icon, l, slug]) => (
                  <button key={l} onClick={() => { setAddOpen(false); toast(`${l}: opening ${slug}`, { description: "Camera, voice and email capture are demo-only for now." }); navigate({ to: "/app/$section", params: { section: slug }, search: { add: 1 } as never }); }}
                    className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium transition hover:border-primary hover:bg-secondary">
                    <Icon className="h-5 w-5 text-primary" />{l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <Toaster />
      </div>
    </StoreProvider>
  );
}
