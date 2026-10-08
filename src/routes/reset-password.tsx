import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — MatrixKeep" },
      { name: "description", content: "Request a password reset link or choose a new password for your MatrixKeep account." },
      { property: "og:title", content: "Reset your password — MatrixKeep" },
      { property: "og:description", content: "Securely reset your MatrixKeep password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

const strong = (p: string) => p.length >= 12 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

function Reset() {
  const nav = useNavigate();
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setRecovery(true);
    supabase.auth.getUser().then(({ data: u }) => { if (u.user?.user_metadata?.["must_change_password"]) setRecovery(true); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY") setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const request = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong(pw)) return toast.error("Use 12+ characters with a capital, a number and a symbol");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    nav({ to: "/app" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8">
        <h1 className="font-display text-3xl text-foreground">{recovery ? "Choose a new password" : "Forgot your password?"}</h1>
        {recovery ? (
          <form onSubmit={save} className="mt-6 space-y-3">
            <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
            <p className="text-xs text-muted-foreground">12+ characters, including a capital, a number and a symbol.</p>
            <Button disabled={busy} className="w-full">Save new password</Button>
          </form>
        ) : sent ? (
          <p className="mt-4 text-sm text-muted-foreground">If an account exists for {email}, a reset link is on its way. Open it on this device.</p>
        ) : (
          <form onSubmit={request} className="mt-6 space-y-3">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <Button disabled={busy} className="w-full">Send reset link</Button>
            <a href="/auth" className="block text-center text-sm text-muted-foreground hover:text-foreground">Back to sign in</a>
          </form>
        )}
      </div>
    </main>
  );
}
