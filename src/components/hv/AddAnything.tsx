import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, DoorOpen, Receipt, Upload, Mic, Mail, X, Loader2, Check, ArrowLeft, Bot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractRecords, type Extracted } from "@/lib/capture.functions";
import { getSection, sections } from "./data";
import { useStore } from "./store";

type Mode = { key: string; label: string; icon: typeof Camera; hint: string; kind: "file" | "voice" | "text" };
const modes: Mode[] = [
  { key: "photo", label: "Take photo", icon: Camera, hint: "Photograph an item — the AI identifies brand, model and type.", kind: "file" },
  { key: "room", label: "Scan room", icon: DoorOpen, hint: "Photograph a whole room — every visible item becomes a record.", kind: "file" },
  { key: "receipt", label: "Scan receipt", icon: Receipt, hint: "Photograph a receipt or invoice — products, prices and warranties are extracted.", kind: "file" },
  { key: "document", label: "Upload document", icon: Upload, hint: "Upload a photo or PDF of a warranty, certificate, policy or manual.", kind: "file" },
  { key: "speak", label: "Speak", icon: Mic, hint: "Describe what you want to add — e.g. “I bought a Dyson V15 from Currys for £599 today”.", kind: "voice" },
  { key: "email", label: "Import email", icon: Mail, hint: "Paste an order confirmation or e-receipt email.", kind: "text" },
];
const sectionOptions = ["assets", "rooms", "documents", "warranties", "vehicles", "maintenance", "tasks", "insurance"];

type Rec = Extracted & { keep: boolean };
type Step = "pick" | "capture" | "processing" | "review" | "saving" | "done";

async function toDataUrl(f: File): Promise<string | undefined> {
  if (!f.type.startsWith("image/")) return undefined;
  const img = await createImageBitmap(f);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

export function AddAnything({ onClose, initial }: { onClose: () => void; initial?: string }) {
  const { addReturning, added, current } = useStore();
  const [step, setStep] = useState<Step>(initial ? "capture" : "pick");
  const [mode, setMode] = useState<Mode | undefined>(modes.find((m) => m.key === initial));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [summary, setSummary] = useState("");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [location, setLocation] = useState("");
  const [room, setRoom] = useState("");
  const [saved, setSaved] = useState<{ section: string; id: string; title: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const biz = current.type !== "individual";
  const locations = (added["locations"] ?? []).map((i) => i.title);
  const rooms = [...(added["rooms"] ?? []).map((i) => i.title), ...(getSection("rooms")?.items ?? []).map((i) => i.title)];

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error("Files must be under 20 MB"); return; }
    setFile(f); setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined);
  };

  const listen = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { toast.error("Voice input isn't supported in this browser — please type instead."); return; }
    const r = new Ctor(); r.lang = "en-GB"; r.interimResults = false;
    r.onresult = (e) => setText((t) => (t ? t + " " : "") + (e.results[0]?.[0]?.transcript ?? ""));
    r.onend = () => setListening(false);
    setListening(true); r.start();
  };

  const process = async () => {
    if (!mode) return;
    if (mode.kind === "file" && !file) { toast.error("Please choose a photo or file first"); return; }
    if (mode.kind !== "file" && !text.trim()) { toast.error("Please add some text first"); return; }
    setStep("processing");
    try {
      const image = file ? await toDataUrl(file) : undefined;
      const r = await extractRecords({ data: { mode: mode.label, text, image, fileName: file?.name } });
      if ("error" in r && r.error) { toast.error(r.error); setStep("capture"); return; }
      if (!("records" in r) || !r.records?.length) { toast.error("Nothing recognisable was found. Try a clearer photo or add a note."); setStep("capture"); return; }
      setSummary(r.summary); setRecs(r.records.map((x) => ({ ...x, keep: true }))); setStep("review");
    } catch { toast.error("Processing failed. Please try again."); setStep("capture"); }
  };

  const save = async () => {
    const keep = recs.filter((r) => r.keep && r.title.trim());
    if (!keep.length) { toast.error("Select at least one record"); return; }
    setStep("saving");
    const out: typeof saved = [];
    for (const r of keep) {
      const fields: [string, string][] = r.fields.map((f) => [f.label, f.value]);
      if (location) fields.push(["Location", location]);
      if (room && !fields.some(([k]) => k === "Room")) fields.push(["Room", room]);
      fields.push(["Captured via", mode?.label ?? "Add anything"]);
      const id = await addReturning(r.section, { id: "", title: r.title.trim(), subtitle: r.subtitle, fields });
      if (id) out.push({ section: r.section, id, title: r.title });
    }
    if (file && out[0]) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        for (const rec of out) {
          const path = `${u.user.id}/${rec.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
          const { error } = await supabase.storage.from("evidence").upload(path, file, { contentType: file.type });
          if (!error) await supabase.from("evidence_files").insert({ item_id: rec.id, path, name: file.name, mime: file.type, size: file.size });
        }
      }
    }
    setSaved(out);
    if (out.length < keep.length) toast.error(`${keep.length - out.length} record(s) couldn't be saved`);
    setStep("done");
  };

  const steps: Step[] = ["capture", "processing", "review", "done"];
  const idx = steps.indexOf(step === "saving" ? "review" : step);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-rise flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-7 py-5">
          <div className="flex items-center gap-3">
            {step === "capture" && <button aria-label="Back" onClick={() => { setStep("pick"); setFile(null); setText(""); }}><ArrowLeft className="h-5 w-5" /></button>}
            <h3 className="font-display text-2xl">{mode && step !== "pick" ? mode.label : "Add anything"}</h3>
          </div>
          <button aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {step !== "pick" && (
          <div className="flex gap-2 px-7 pt-4">
            {["Capture", "AI reading", "Review", "Saved"].map((l, i) => (
              <div key={l} className="flex-1"><div className={`h-1 rounded-full ${i <= idx ? "bg-aurora" : "bg-secondary"}`} /><p className={`mt-1 text-xs ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{l}</p></div>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-7">
          {step === "pick" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {modes.map((m) => (
                <button key={m.key} onClick={() => { setMode(m); setStep("capture"); }} className="flex flex-col items-center gap-2 rounded-2xl border p-5 text-sm font-medium transition hover:border-primary hover:bg-secondary">
                  <m.icon className="h-6 w-6 text-primary" />{m.label}
                </button>
              ))}
            </div>
          )}

          {step === "capture" && mode && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{mode.hint}</p>
              {mode.kind === "file" && (
                <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current?.click()} className="grid min-h-48 cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-6 text-center hover:border-primary">
                  {preview ? <img src={preview} alt="Selected" className="max-h-64 rounded-xl" />
                    : file ? <p className="font-medium">{file.name}</p>
                    : <div><mode.icon className="mx-auto h-8 w-8 text-primary" /><p className="mt-2 text-sm font-medium">Tap to take a photo or choose a file</p><p className="text-xs text-muted-foreground">Photos or PDF, up to 20 MB</p></div>}
                  <input ref={fileRef} type="file" accept={mode.key === "document" ? "image/*,application/pdf" : "image/*"} capture={mode.key === "document" ? undefined : "environment"} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                </div>
              )}
              {mode.kind === "voice" && (
                <button type="button" onClick={listen} disabled={listening} className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-6 text-sm font-semibold ${listening ? "animate-pulse border-primary text-primary" : ""}`}>
                  <Mic className="h-5 w-5" />{listening ? "Listening…" : "Tap and speak"}
                </button>
              )}
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={mode.kind === "file" ? 2 : 6} maxLength={8000}
                placeholder={mode.kind === "file" ? "Optional note, e.g. “bought in 2024, kitchen”" : mode.kind === "voice" ? "Your words appear here — you can also type." : "Paste the email here"}
                className="w-full rounded-2xl border bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
              {mode.kind === "file" && file && !file.type.startsWith("image/") && <p className="text-xs text-muted-foreground">PDFs are saved as evidence; the AI reads the file name and your note. Add key details in the note for best results.</p>}
              <button onClick={process} className="w-full rounded-full bg-aurora py-3 text-sm font-semibold text-primary-foreground shadow-glow">Let the AI read it</button>
            </div>
          )}

          {step === "processing" && (
            <div className="py-12 text-center">
              <Bot className="mx-auto h-10 w-10 animate-pulse text-primary" />
              <p className="mt-4 font-semibold">Your capture agent is reading this…</p>
              <p className="mt-1 text-sm text-muted-foreground">Identifying items, prices, dates and warranties.</p>
              <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {(step === "review" || step === "saving") && (
            <div className="space-y-4">
              <p className="rounded-2xl bg-secondary p-4 text-sm">{summary}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {biz && (
                  <label className="text-xs font-medium text-muted-foreground">Location
                    <select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground">
                      <option value="">{locations.length ? "Choose location" : "No locations yet"}</option>
                      {locations.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-xs font-medium text-muted-foreground">Room
                  <select value={room} onChange={(e) => setRoom(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground">
                    <option value="">Not set</option>
                    {[...new Set(rooms)].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
              </div>
              {recs.map((r, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${r.keep ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={r.keep} onChange={(e) => setRecs((x) => x.map((y, j) => (j === i ? { ...y, keep: e.target.checked } : y)))} aria-label="Include" />
                    <input value={r.title} onChange={(e) => setRecs((x) => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold" />
                    <select value={r.section} onChange={(e) => setRecs((x) => x.map((y, j) => (j === i ? { ...y, section: e.target.value as Rec["section"] } : y)))} className="rounded-lg border bg-background px-2 py-1.5 text-xs">
                      {sectionOptions.map((s) => <option key={s} value={s}>{getSection(s)?.title ?? s}</option>)}
                    </select>
                  </div>
                  {r.subtitle && <p className="mt-2 text-xs text-muted-foreground">{r.subtitle}</p>}
                  {r.fields.length > 0 && <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{r.fields.map((f) => <div key={f.label} className="flex gap-1"><dt className="text-muted-foreground">{f.label}:</dt><dd className="font-medium">{f.value}</dd></div>)}</dl>}
                </div>
              ))}
              <button disabled={step === "saving"} onClick={save} className="w-full rounded-full bg-aurora py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
                {step === "saving" ? "Saving…" : `Save ${recs.filter((r) => r.keep).length} record(s)`}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <Check className="mx-auto h-10 w-10 text-success" />
              <p className="font-display text-2xl">Saved to {current.name}</p>
              {file && <p className="text-sm text-muted-foreground">The original file is attached as evidence to each record.</p>}
              <div className="space-y-2 text-left">
                {saved.map((s) => {
                  const sec = sections.find((x) => x.slug === s.section);
                  return <Link key={s.id} to="/app/$section/$id" params={{ section: s.section, id: s.id }} onClick={onClose} className="flex items-center justify-between rounded-2xl border p-3 text-sm hover:border-primary"><span className="font-medium">{s.title}</span><span className="text-xs text-muted-foreground">{sec?.title}</span></Link>;
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setStep("pick"); setFile(null); setText(""); setRecs([]); }} className="flex-1 rounded-full border py-3 text-sm font-semibold">Add more</button>
                <button onClick={onClose} className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SR = { lang: string; interimResults: boolean; start: () => void; onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void; onend: () => void };
