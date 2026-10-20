import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { isGoogleAuthEnabled, supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/hv/Logo";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Home,
  Eye,
  EyeOff,
  ShieldCheck,
  BriefcaseBusiness,
} from "lucide-react";
import authHome from "@/assets/auth-home.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MatrixKeep AI" },
      { name: "description", content: "Sign in or create your MatrixKeep AI account." },
      { property: "og:title", content: "Sign in — MatrixKeep AI" },
      { property: "og:description", content: "Sign in or create your MatrixKeep AI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [showPassword, setShowPassword] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    isGoogleAuthEnabled()
      .then((enabled) => {
        if (active) setGoogleEnabled(enabled);
      })
      .catch(() => {
        if (active) setGoogleEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/app" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse({ email, password });
    if (!p.success) {
      toast.error(p.error.issues[0]?.message);
      return;
    }
    if (mode === "up" && kind !== "individual" && !org.trim()) {
      toast.error("Please enter your organisation name");
      return;
    }
    setBusy(true);
    if (mode === "up") {
      if (voucher.trim()) localStorage.setItem("hv-voucher", voucher.trim().slice(0, 40));
      const b = kind !== "individual";
      const { error } = await supabase.auth.signUp({
        ...p.data,
        options: {
          emailRedirectTo: window.location.origin + "/app/plans",
          data: {
            full_name: name.trim().slice(0, 100),
            account_type: kind,
            org_name: b ? org.trim().slice(0, 200) : undefined,
            business_type: b ? btype : undefined,
            sector: b ? industry : undefined,
            org_size: b ? size : undefined,
            branches: b && /^\d{1,5}$/.test(branches) ? branches : undefined,
          },
        },
      });
      if (error) toast.error(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword(p.data);
      if (error) toast.error(error.message);
    }
    setBusy(false);
  };

  const google = async () => {
    if (!googleEnabled) return;
    const r = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="auth-experience min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-6 py-5 md:px-10">
        <Logo />
        <Button asChild variant="ghost">
          <Link to="/">
            <ArrowLeft />
            Back to website
          </Link>
        </Button>
      </header>
      <main className="grid min-h-[calc(100vh-81px)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden overflow-hidden lg:block">
          <img
            src={authHome}
            width={1536}
            height={1024}
            alt="A sunlit home with carefully kept belongings"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="auth-image-shade absolute inset-0" />
          <div className="relative flex h-full flex-col justify-end p-12 text-midnight-foreground">
            <p className="text-sm uppercase tracking-wider">MatrixKeep</p>
            <h2 className="mt-4 max-w-lg font-display text-5xl leading-tight">
              Keep what matters.
              <br />
              Know what’s next.
            </h2>
            <p className="mt-5 max-w-md text-lg text-midnight-foreground/85">
              One place for everything you own, operate and need to remember.
            </p>
            <div className="mt-8 flex items-center gap-2 border-t border-midnight-foreground/25 pt-6 text-sm">
              <ShieldCheck className="h-5 w-5" />
              Your records. Your workspace.
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-5 py-10 md:px-12">
          <div className="w-full max-w-lg animate-rise">
            {sent ? (
              <div className="mt-8 space-y-3">
                <h1 className="font-display text-3xl">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to {email}. Click it to open your MatrixKeep.
                </p>
              </div>
            ) : (
              <>
                <h1 className="font-display text-4xl">
                  {mode === "in" ? "Welcome back" : "Create your MatrixKeep"}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {mode === "in"
                    ? "Your home and business, right where you left them."
                    : "Start a new chapter for your home or organisation."}
                </p>
                <div className="mt-6 grid grid-cols-2 border-b">
                  <Button
                    variant="ghost"
                    onClick={() => setMode("in")}
                    className={`rounded-none border-b-2 ${mode === "in" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                  >
                    Sign in
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setMode("up")}
                    className={`rounded-none border-b-2 ${mode === "up" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                  >
                    Create account
                  </Button>
                </div>
                {googleEnabled && (
                  <>
                    <Button variant="outline" onClick={google} className="mt-6 h-11 w-full">
                      <span aria-hidden="true" className="text-lg font-bold">
                        G
                      </span>
                      Continue with Google
                    </Button>
                    <div className="my-5 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or with email
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}
                <form onSubmit={submit} className="mt-6 space-y-3">
                  {mode === "up" && (
                    <div className="grid grid-cols-3 gap-2">
                      {(["individual", "business", "enterprise"] as const).map((k) => (
                        <Button
                          type="button"
                          variant="outline"
                          key={k}
                          onClick={() => setKind(k)}
                          aria-pressed={kind === k}
                          className={`h-20 flex-col gap-2 px-2 text-xs ${kind === k ? "border-primary bg-primary/5 text-primary" : ""}`}
                        >
                          {k === "individual" ? (
                            <Home />
                          ) : k === "business" ? (
                            <BriefcaseBusiness />
                          ) : (
                            <Building2 />
                          )}
                          {k === "individual"
                            ? "Individual"
                            : k === "business"
                              ? "Business"
                              : "Enterprise"}
                        </Button>
                      ))}
                    </div>
                  )}
                  {mode === "up" && kind !== "individual" && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={btype}
                        onChange={(e) => setBtype(e.target.value)}
                        className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Business type</option>
                        {[
                          "Sole trader",
                          "Partnership",
                          "Limited company",
                          "Charity",
                          "Public sector",
                          "Franchise",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Industry</option>
                        {[
                          "Retail",
                          "Restaurant & hospitality",
                          "Office & professional services",
                          "School & education",
                          "Clinic & healthcare",
                          "Garage & automotive",
                          "Construction",
                          "Property management",
                          "Warehouse & logistics",
                          "Manufacturing",
                          "Technology",
                          "Charity",
                          "Other",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <select
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Organisation size</option>
                        {["1–9", "10–49", "50–249", "250–999", "1,000+"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <input
                        value={branches}
                        onChange={(e) => setBranches(e.target.value.replace(/\D/g, "").slice(0, 5))}
                        inputMode="numeric"
                        placeholder="Locations / branches"
                        className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  )}
                  {mode === "up" && kind !== "individual" && (
                    <input
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                      placeholder="Organisation name"
                      maxLength={200}
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                  {mode === "up" && (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                  <label className="block text-sm font-medium">
                    Email
                    <input
                      aria-label="Email"
                      required
                      autoComplete="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1 w-full rounded-md border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Password
                    <div className="relative mt-1">
                      <input
                        aria-label="Password"
                        required
                        autoComplete={mode === "in" ? "current-password" : "new-password"}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === "up" ? "At least 8 characters" : "Your password"}
                        className="w-full rounded-md border bg-card px-4 py-2.5 pr-12 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-0.5"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </label>
                  {mode === "in" && (
                    <div className="text-right">
                      <a href="/reset-password" className="text-xs text-primary hover:underline">
                        Forgot password?
                      </a>
                    </div>
                  )}
                  {mode === "up" && (
                    <input
                      value={voucher}
                      onChange={(e) => setVoucher(e.target.value)}
                      placeholder="Voucher code (optional)"
                      maxLength={40}
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring uppercase"
                    />
                  )}
                  <Button disabled={busy} className="h-11 w-full">
                    {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
                    <ArrowRight />
                  </Button>
                </form>
                <Button
                  variant="ghost"
                  onClick={() => setMode(mode === "in" ? "up" : "in")}
                  className="mt-5 w-full text-sm text-muted-foreground"
                >
                  {mode === "in"
                    ? "New here? Create an account"
                    : "Already have an account? Sign in"}
                </Button>
                {mode === "up" && googleEnabled && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Google accounts start as Individual. You can change account type in My Profile.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Toaster />
    </div>
  );
}
