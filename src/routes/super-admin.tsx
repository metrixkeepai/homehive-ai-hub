import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkSuperAdmin } from "@/lib/admin.functions";
import { Logo } from "@/components/hv/Logo";
import { Toaster } from "@/components/ui/sonner";
import { LayoutDashboard, Users, Ticket, ScrollText, LogOut, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/super-admin/login" });
    const { isSuperAdmin } = await checkSuperAdmin();
    if (!isSuperAdmin) throw redirect({ to: "/super-admin/login", search: { denied: 1 } });
    return { adminEmail: data.user.email ?? "" };
  },
  head: () => ({ meta: [{ title: "Control Centre — MatrixKeep" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminShell,
});

const nav = [
  { to: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/super-admin/subscribers", label: "Subscribers", icon: Users },
  { to: "/super-admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/super-admin/audit", label: "Audit log", icon: ScrollText },
] as const;

function AdminShell() {
  const { adminEmail } = Route.useRouteContext();
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
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-midnight-foreground/70 hover:bg-midnight-foreground/10 hover:text-midnight-foreground" activeProps={{ className: "bg-midnight-foreground/15 text-midnight-foreground" }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-midnight-foreground/10 p-4 text-xs">
          <p className="truncate text-midnight-foreground/60">{adminEmail}</p>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-midnight-foreground/80 hover:text-midnight-foreground"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 overflow-x-auto border-b bg-background px-4 py-3 md:hidden">
          {nav.map((n) => <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground" activeProps={{ className: "bg-muted text-foreground" }}>{n.label}</Link>)}
          <button onClick={signOut} className="ml-auto text-sm text-muted-foreground">Sign out</button>
        </header>
        <main className="flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
      <Toaster />
    </div>
  );
}
