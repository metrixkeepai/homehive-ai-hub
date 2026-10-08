import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { checkSuperAdmin } from "@/lib/admin.functions";
import { Logo } from "@/components/hv/Logo";
import { Toaster } from "@/components/ui/sonner";
import { LayoutDashboard, Users, Ticket, ScrollText, LogOut, ShieldCheck, PoundSterling, CreditCard, Bot, Server, Layers, Repeat, ToggleLeft, Plug, Activity, HeartPulse } from "lucide-react";
import { useState } from "react";
import { completePasswordChange } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/super-admin/login" });
    const check = await checkSuperAdmin();
    if (!check.isSuperAdmin) throw redirect({ to: "/super-admin/login", search: { denied: 1 } });
    return { adminEmail: data.user.email ?? "", mustChangePassword: check.mustChangePassword };
  },
  head: () => ({ meta: [{ title: "Control Centre — MatrixKeep" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminShell,
});

const groups = [
  ["Overview", [{ to: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true }]],
  ["Customers", [{ to: "/super-admin/subscribers", label: "Subscribers", icon: Users }, { to: "/super-admin/subscriptions", label: "Subscriptions", icon: Repeat }, { to: "/super-admin/plans", label: "Plans", icon: Layers }, { to: "/super-admin/vouchers", label: "Vouchers", icon: Ticket }]],
  ["Money", [{ to: "/super-admin/revenue", label: "Revenue", icon: PoundSterling }, { to: "/super-admin/payments", label: "Stripe & payments", icon: CreditCard }]],
  ["Costs & usage", [{ to: "/super-admin/ai", label: "AI usage & cost", icon: Bot }, { to: "/super-admin/infrastructure", label: "Infrastructure", icon: Server }, { to: "/super-admin/api", label: "API usage", icon: Activity }]],
  ["Platform", [{ to: "/super-admin/health", label: "Health", icon: HeartPulse }, { to: "/super-admin/integrations", label: "Integrations", icon: Plug }, { to: "/super-admin/flags", label: "Feature switches", icon: ToggleLeft }, { to: "/super-admin/audit", label: "Audit log", icon: ScrollText }]],
] as const;
const nav = groups.flatMap(([, items]) => items as readonly { to: string; label: string; icon: typeof Users; exact?: boolean }[]);

function AdminShell() {
  const { adminEmail, mustChangePassword } = Route.useRouteContext();
  const [changed, setChanged] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/super-admin/login", replace: true });
  }
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col bg-midnight text-midnight-foreground md:flex">
        <div className="p-5"><Logo light /><p className="mt-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-midnight-foreground/50"><ShieldCheck className="h-3.5 w-3.5" />Control Centre</p></div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3">
          {groups.map(([g, items]) => (<div key={g}><p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-midnight-foreground/40">{g}</p>{(items as readonly any[]).map((n) => (
            <Link key={n.to} to={n.to as "/super-admin"} activeOptions={{ exact: !!n.exact }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-midnight-foreground/70 hover:bg-midnight-foreground/10 hover:text-midnight-foreground" activeProps={{ className: "bg-midnight-foreground/15 text-midnight-foreground" }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}</div>))}
        </nav>
        <div className="border-t border-midnight-foreground/10 p-4 text-xs">
          <p className="truncate text-midnight-foreground/60">{adminEmail}</p>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-midnight-foreground/80 hover:text-midnight-foreground"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 overflow-x-auto border-b bg-background px-4 py-3 md:hidden">
          {nav.map((n) => <Link key={n.to} to={n.to as "/super-admin"} activeOptions={{ exact: !!n.exact }} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground" activeProps={{ className: "bg-muted text-foreground" }}>{n.label}</Link>)}
          <button onClick={signOut} className="ml-auto text-sm text-muted-foreground">Sign out</button>
        </header>
        <main className="flex-1 p-4 md:p-8">{mustChangePassword && !changed ? <ChangePassword onDone={() => setChanged(true)} /> : <Outlet />}</main>
      </div>
      <Toaster />
    </div>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const done = useServerFn(completePasswordChange);
  const [cur, setCur] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (pw.length < 12 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) return setErr("Use at least 12 characters with a capital letter, a number and a symbol.");
    if (pw !== pw2) return setErr("The new passwords don't match.");
    if (pw === cur) return setErr("Choose a password different from the temporary one.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as any);
    if (error) { setBusy(false); return setErr(error.message); }
    await done(); onDone();
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border bg-card p-8">
      <h1 className="font-display text-2xl text-foreground">Set your own password</h1>
      <p className="text-sm text-muted-foreground">You signed in with a temporary password. Choose a new one before using the Control Centre.</p>
      <Input type="password" placeholder="Temporary password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <Input type="password" placeholder="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <Input type="password" placeholder="Repeat new password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
    </form>
  );
}
