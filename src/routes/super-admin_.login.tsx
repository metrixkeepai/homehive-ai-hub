import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { checkSuperAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/hv/Logo";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/super-admin_/login")({
  validateSearch: (s: Record<string, unknown>) => ({ denied: s["denied"] ? 1 : undefined }),
  head: () => ({
    meta: [
      { title: "Control Centre sign in — MatrixKeep" },
      { name: "description", content: "Restricted sign in for MatrixKeep platform administrators." },
      { property: "og:title", content: "Control Centre sign in — MatrixKeep" },
      { property: "og:description", content: "Restricted sign in for MatrixKeep platform administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

function AdminLogin() {
  const { denied } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(denied ? "This account doesn't have Super Admin access." : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
    if (err) { setBusy(false); return setError("Sign in failed. Check your email and password."); }
    try {
      const { isSuperAdmin } = await checkSuperAdmin();
      if (!isSuperAdmin) { await supabase.auth.signOut(); setBusy(false); return setError("This account doesn't have Super Admin access."); }
      navigate({ to: "/super-admin", replace: true });
    } catch { setBusy(false); setError("Couldn't verify access. Try again."); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-midnight px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-midnight-foreground/10 bg-card p-8 shadow-xl">
        <Logo />
        <div className="mt-6 flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Restricted area</span></div>
        <h1 className="mt-2 font-display text-2xl text-foreground">MatrixKeep Control Centre</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform administrators only. Every action is recorded.</p>
        <div className="mt-6 space-y-4">
          <div><Label htmlFor="em">Email</Label><Input id="em" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Checking…" : "Sign in"}</Button>
        </div>
      </form>
    </div>
  );
}
