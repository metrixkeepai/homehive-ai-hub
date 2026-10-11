import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Globe, FileDown, Link2, Mail, MessageCircle, Copy, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Item } from "./data";
import { buildPassportHtml, exportPassport, PASSPORT_SECTIONS, REPORT_TYPES, type Format, type Privacy, type SectionSlug } from "./passport-report";
import { buildEmail, buildPassportShareMessage, composeShare, ENTITY_BY_SECTION, shareUrl } from "@/lib/passport-share";

export const PASSPORT_KINDS: Record<string, string> = { "my-home": "Home Digital Passport", assets: "Asset Passport", vehicles: "Vehicle Passport", locations: "Location Passport" };

type Props = { open: boolean; onClose: () => void; mode: "download" | "share"; section: string; item: Item; added: Record<string, Item[]>; owner: string };
type Share = { id: string; token: string; title: string; expires_at: string; revoked: boolean; views: number };

const FORMATS: [Format, string, string, typeof FileText][] = [
  ["pdf", "PDF", "Best for sharing, printing and keeping a permanent record.", FileDown],
  ["word", "Word", "Editable Microsoft Word document for customisation and handovers.", FileText],
  ["html", "HTML", "Interactive web-ready version that opens in your browser.", Globe],
];
const EXPIRY: [string, number][] = [["24 hours", 1], ["7 days", 7], ["30 days", 30]];

export function PassportModal({ open, onClose, mode, section, item, added, owner }: Props) {
  const kind = PASSPORT_KINDS[section] ?? "Digital Passport";
  const whole = section === "my-home";
  const [format, setFormat] = useState<Format>("pdf");
  const [reportType, setReportType] = useState("Full Digital Passport");
  const [include, setInclude] = useState<SectionSlug[]>(REPORT_TYPES["Full Digital Passport"]!);
  const [privacy, setPrivacy] = useState<Privacy>({ prices: false, values: false, insurance: false, contacts: false });
  const [stage, setStage] = useState<"form" | "working" | "done" | "error">("form");
  const [days, setDays] = useState(7);
  const [link, setLink] = useState("");
  const [shares, setShares] = useState<Share[]>([]);
  const entity = ENTITY_BY_SECTION[section] ?? "other";
  const [showName, setShowName] = useState(entity !== "property");
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<Date | null>(null);

  useEffect(() => { if (open) { setStage("form"); setLink(""); } }, [open]);
  const loadShares = async () => {
    const { data } = await supabase.from("passport_shares").select("id,token,title,expires_at,revoked,views").eq("title", `${kind}: ${item.title}`).order("created_at", { ascending: false });
    setShares((data ?? []) as Share[]);
  };
  useEffect(() => { if (open && mode === "share") void loadShares(); }, [open, mode]);

  const html = useMemo(() => buildPassportHtml(item, added, owner, { reportType, include, privacy }, kind, whole), [item, added, owner, reportType, include, privacy, kind, whole]);
  const fmtLabel = FORMATS.find(([f]) => f === format)![1];

  const pickType = (t: string) => { setReportType(t); if (t !== "Custom Report") setInclude(REPORT_TYPES[t]!); };
  const toggle = (s: SectionSlug) => { setReportType("Custom Report"); setInclude((c) => c.includes(s) ? c.filter((x) => x !== s) : [...c, s]); };

  const generate = async () => {
    setStage("working");
    try {
      if (mode === "download") { setStage("done"); return; }
      const exp = new Date(Date.now() + days * 86400000);
      const { data, error } = await supabase.from("passport_shares").insert({ title: `${kind}: ${item.title}`, html, expires_at: exp.toISOString() }).select("token").single();
      if (error || !data) throw error;
      setExpiry(exp); setCustomBody(null);
      setLink(shareUrl(window.location.origin, data.token, entity)); setStage("done"); void loadShares();
    } catch { setStage("error"); }
  };
  const download = () => { exportPassport(format, html, item.id); toast.success("Passport ready", { description: `Your ${fmtLabel} ${kind} has been prepared.` }); };
  const revoke = async (id: string) => { const { error } = await supabase.from("passport_shares").update({ revoked: true }).eq("id", id); if (error) toast.error("Couldn't revoke link"); else { toast.success("Link revoked"); void loadShares(); } };
  const copy = async (u: string) => { await navigator.clipboard.writeText(u); toast.success("Link copied"); };
  const shareInput = { entity, name: showName ? item.title : undefined, expiresAt: expiry };
  const defaultBody = buildPassportShareMessage(shareInput);
  const body = customBody ?? defaultBody;
  const setBody = setCustomBody;
  const fullMsg = composeShare(body, link, entity);
  const email = buildEmail(shareInput, link);
  const copyMsg = async () => { await navigator.clipboard.writeText(fullMsg); toast.success("✓ Share message copied", { description: "Your MatrixKeep invitation is ready to send." }); };

  const chk = (on: boolean, label: string, fn: () => void) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={on} onChange={fn} className="h-4 w-4 accent-[hsl(var(--primary))]" />{label}</label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl p-0">
        <div className="p-6 sm:p-8">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-widest text-primary">MATRIXKEEP DIGITAL PASSPORT</span>
          {stage === "form" && <>
            <DialogTitle className="mt-4 font-display text-3xl">{mode === "download" ? `Take your ${whole ? "home's" : "record's"} Digital Passport with you` : "Share a secure passport link"}</DialogTitle>
            <DialogDescription className="mt-2">{mode === "download" ? "Create a professional record of your property, assets, warranties, documents and important history — ready to keep, print or share." : "Anyone with the link can view a read-only copy until it expires or you revoke it. They can't see anything else in your account."}</DialogDescription>

            {mode === "download" ? <>
              <h3 className="mt-6 font-semibold">Choose your format</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {FORMATS.map(([f, name, desc, Icon]) => (
                  <button key={f} onClick={() => setFormat(f)} className={`relative rounded-2xl border p-4 text-left transition ${format === f ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-primary/40"}`}>
                    {f === "pdf" && <span className="absolute right-3 top-3 rounded-full bg-success/15 px-2 text-[10px] font-semibold text-success">Recommended</span>}
                    <Icon className="h-6 w-6 text-primary" /><p className="mt-2 font-semibold">{name}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </> : <>
              <h3 className="mt-6 font-semibold">Link expires after</h3>
              <div className="mt-3 flex gap-2">{EXPIRY.map(([l, d]) => <button key={d} onClick={() => setDays(d)} className={`rounded-full border px-4 py-2 text-sm ${days === d ? "border-primary bg-primary/10 text-primary" : ""}`}>{l}</button>)}</div>
            </>}

            <h3 className="mt-6 font-semibold">What would you like to create?</h3>
            <select value={reportType} onChange={(e) => pickType(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm">
              {Object.keys(REPORT_TYPES).map((t) => <option key={t}>{t}</option>)}
            </select>

            <details className="mt-4 rounded-2xl border p-4" open>
              <summary className="cursor-pointer font-semibold">What's included?</summary>
              <div className="mt-3 grid grid-cols-2 gap-2">{PASSPORT_SECTIONS.map(([s, l]) => <div key={s}>{chk(include.includes(s), l, () => toggle(s))}</div>)}</div>
            </details>
            <details className="mt-3 rounded-2xl border p-4">
              <summary className="cursor-pointer font-semibold">Privacy & sensitive information</summary>
              <div className="mt-3 grid gap-2">
                {chk(privacy.prices, "Include purchase prices", () => setPrivacy((p) => ({ ...p, prices: !p.prices })))}
                {chk(privacy.values, "Include estimated asset values", () => setPrivacy((p) => ({ ...p, values: !p.values })))}
                {chk(privacy.insurance, "Include insurance information", () => setPrivacy((p) => ({ ...p, insurance: !p.insurance })))}
                {chk(privacy.contacts, "Include personal contact details", () => setPrivacy((p) => ({ ...p, contacts: !p.contacts })))}
                <p className="text-xs text-muted-foreground">Only include information you're comfortable {mode === "share" ? "sharing" : "keeping in the exported copy"}.</p>
              </div>
            </details>

            <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-secondary p-4 text-sm">
              <div><p className="text-xs text-muted-foreground">{kind}</p><p className="font-medium">{item.title}</p></div>
              <div><p className="text-xs text-muted-foreground">{mode === "download" ? "Format" : "Expires"}</p><p className="font-medium">{mode === "download" ? fmtLabel : EXPIRY.find(([, d]) => d === days)![0]}</p></div>
              <div><p className="text-xs text-muted-foreground">Included</p><p className="font-medium">{include.length + 1} sections</p></div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-full border px-5 py-2.5 text-sm font-semibold">Cancel</button>
              <button onClick={generate} className="rounded-full bg-aurora px-6 py-2.5 text-sm font-semibold text-primary-foreground">{mode === "download" ? `Generate ${fmtLabel} Passport` : "Create secure link"}</button>
            </div>
          </>}

          {stage === "working" && <div className="py-12 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><DialogTitle className="mt-4 font-display text-2xl">Preparing your Digital Passport</DialogTitle><DialogDescription>Bringing your records together.</DialogDescription></div>}

          {stage === "error" && <div className="py-10 text-center">
            <DialogTitle className="font-display text-2xl">We couldn't prepare your passport</DialogTitle>
            <DialogDescription className="mt-2">Your MatrixKeep records are safe. Nothing has been changed.</DialogDescription>
            <div className="mt-6 flex justify-center gap-2"><button onClick={generate} className="rounded-full bg-aurora px-5 py-2.5 text-sm font-semibold text-primary-foreground">Try again</button><button onClick={onClose} className="rounded-full border px-5 py-2.5 text-sm font-semibold">Cancel</button></div>
          </div>}

          {stage === "done" && <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"><Check className="h-7 w-7" /></div>
            <DialogTitle className="mt-4 font-display text-2xl">{mode === "download" ? "Your Digital Passport is ready" : "Your secure link is ready"}</DialogTitle>
            <DialogDescription className="mt-1">{item.title} · {mode === "download" ? `${fmtLabel} • ${reportType}` : `expires in ${EXPIRY.find(([, d]) => d === days)![0]}`}</DialogDescription>
            {mode === "download" ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button onClick={download} className="rounded-full bg-aurora px-6 py-2.5 text-sm font-semibold text-primary-foreground">Download {fmtLabel}</button>
                <button onClick={() => setStage("form")} className="rounded-full border px-5 py-2.5 text-sm font-semibold">Generate another format</button>
              </div>
            ) : (
              <div className="mt-5 space-y-3 text-left">
                <div><p className="font-display text-lg">Share Your Digital Passport</p><p className="text-xs text-muted-foreground">Send a secure, professional view without giving anyone access to your MatrixKeep account.</p></div>
                <div className="flex flex-wrap gap-2">
                  <a href={`https://wa.me/?text=${encodeURIComponent(fullMsg)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-primary-foreground"><MessageCircle className="h-4 w-4" />WhatsApp</a>
                  <a href={`mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"><Mail className="h-4 w-4" />Email</a>
                  <button onClick={copyMsg} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"><Copy className="h-4 w-4" />Copy Message</button>
                  <button onClick={() => copy(link)} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"><Link2 className="h-4 w-4" />Copy Link</button>
                  {typeof navigator !== "undefined" && "share" in navigator && <button onClick={() => navigator.share({ title: "MatrixKeep Digital Passport", text: body, url: link }).catch(() => {})} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold">More…</button>}
                </div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showName} onChange={() => { setShowName(!showName); setBody(null); }} className="h-4 w-4 accent-[hsl(var(--primary))]" />Mention “{item.title}” in the message</label>
                <div>
                  <div className="flex items-center justify-between"><p className="text-sm font-semibold">Message Preview</p>{body !== defaultBody && <button onClick={() => setBody(null)} className="text-xs font-semibold text-primary">Reset to MatrixKeep default</button>}</div>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} aria-label="Edit message" className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm" />
                  <p className="mt-1 break-all rounded-xl border bg-muted px-3 py-2 text-xs text-muted-foreground">{link} <span className="whitespace-nowrap">· secure link (can't be edited)</span></p>
                </div>
              </div>
            )}
          </div>}

          {mode === "share" && shares.length > 0 && stage !== "working" && <div className="mt-6 border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Links you've shared</h3>
            <ul className="mt-2 space-y-2 text-sm">{shares.map((s) => {
              const live = !s.revoked && new Date(s.expires_at) > new Date();
              return <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                <span>{live ? `Expires ${new Date(s.expires_at).toLocaleDateString("en-GB")}` : s.revoked ? "Revoked" : "Expired"} · {s.views} views</span>
                {live && <span className="flex gap-2"><button onClick={() => copy(shareUrl(window.location.origin, s.token, entity))} className="text-primary">Copy</button><button onClick={() => revoke(s.id)} className="text-destructive">Revoke</button></span>}
              </li>;
            })}</ul>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
