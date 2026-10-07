import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/hv/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HomeVault AI" },
      { name: "description", content: "Sign in or create your HomeVault AI account." },
      { property: "og:title", content: "Sign in — HomeVault AI" },
      { property: "og:description", content: "Sign in or create your HomeVault AI account." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"individual" | "business" | "enterprise">("individual");
  const [org, setOrg] = useState("");
  const [btype, setBtype] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [branches, setBranches] = useState("");
  const [voucher, setVoucher] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/app" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: "/app" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse({ email, password });
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    if (mode === "up" && kind !== "individual" && !org.trim()) { toast.error("Please enter your organisation name"); return; }
    setBusy(true);
    if (mode === "up") {
      if (voucher.trim()) localStorage.setItem("hv-voucher", voucher.trim().slice(0, 40));
      const b = kind !== "individual";
      const { error } = await supabase.auth.signUp({ ...p.data, options: { emailRedirectTo: window.location.origin + "/app/plans", data: { full_name: name.trim().slice(0, 100), account_type: kind, org_name: b ? org.trim().slice(0, 200) : undefined, business_type: b ? btype : undefined, sector: b ? industry : undefined, org_size: b ? size : undefined, branches: b && /^\d{1,5}$/.test(branches) ? branches : undefined } } });
      if (error) toast.error(error.message); else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword(p.data);
      if (error) toast.error(error.message);
    }
    setBusy(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-soft">
        <Logo />
        {sent ? (
          <div className="mt-8 space-y-3">
            <h1 className="font-display text-3xl">Check your email</h1>
            <p className="text-sm text-muted-foreground">We sent a confirmation link to {email}. Click it to open your HomeVault.</p>
          </div>
        ) : (
          <>
            <h1 className="mt-8 font-display text-3xl">{mode === "in" ? "Welcome back" : "Create your HomeVault"}</h1>
            <button onClick={google} className="mt-6 w-full rounded-full border py-3 text-sm font-semibold transition hover:bg-secondary">Continue with Google</button>
            <p className="my-5 text-center text-xs text-muted-foreground">or with email</p>
            <form onSubmit={submit} className="space-y-3">
              {mode === "up" && (
                <div className="grid grid-cols-3 gap-2">
                  {(["individual", "business", "enterprise"] as const).map((k) => (
                    <button type="button" key={k} onClick={() => setKind(k)} className={`rounded-xl border px-2 py-2.5 text-xs font-medium transition ${kind === k ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary"}`}>{k === "individual" ? "My home" : k === "business" ? "My business" : "Large organisation"}</button>
                  ))}
                </div>
              )}
              {mode === "up" && kind !== "individual" && (
                <div className="grid grid-cols-2 gap-2">
                  <select value={btype} onChange={(e) => setBtype(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="">Business type</option>{["Sole trader", "Partnership", "Limited company", "Charity", "Public sector", "Franchise"].map((x) => <option key={x}>{x}</option>)}</select>
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="">Industry</option>{["Retail", "Restaurant & hospitality", "Office & professional services", "School & education", "Clinic & healthcare", "Garage & automotive", "Construction", "Property management", "Warehouse & logistics", "Manufacturing", "Technology", "Charity", "Other"].map((x) => <option key={x}>{x}</option>)}</select>
                  <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="">Organisation size</option>{["1–9", "10–49", "50–249", "250–999", "1,000+"].map((x) => <option key={x}>{x}</option>)}</select>
                  <input value={branches} onChange={(e) => setBranches(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="Locations / branches" className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}
              {mode === "up" && kind !== "individual" && <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation name" maxLength={200} className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />}
              {mode === "up" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              {mode === "up" && <input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Voucher code (optional)" maxLength={40} className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring uppercase" />}
              <button disabled={busy} className="w-full rounded-full bg-aurora py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
            </form>
            <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground">
              {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </>
        )}
      </div>
      <Toaster />
    </div>
  );
}
