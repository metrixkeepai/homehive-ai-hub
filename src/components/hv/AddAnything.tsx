import { sameRoomFrame } from "@/lib/room-frames";
import { encodeSpeechWav } from "@/lib/speech-audio";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Camera,
  DoorOpen,
  Receipt,
  Upload,
  Mic,
  Mail,
  X,
  Loader2,
  Check,
  ArrowLeft,
  Bot,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { decideReview } from "@/lib/google.functions";
import { extractRecords, type Extracted } from "@/lib/capture.functions";
import { transcribeToEnglish } from "@/lib/speech.functions";
import { getSection, sections } from "./data";
import { useStore } from "./store";
import { usePlanGate } from "./Upgrade";
import { deriveContractDates, isAutoRenew, noticeDeadline } from "@/lib/contract-dates";
import { DOC_ACCEPT, extractFileText, fileHash, tiffToPng } from "@/lib/file-text";
const modeFeature: Record<string, [string, string]> = {
  room: ["room_scan", "room scans"],
  email: ["email_import", "email import"],
  speak: ["voice_capture", "voice capture"],
};

type Mode = {
  key: string;
  label: string;
  icon: typeof Camera;
  hint: string;
  kind: "file" | "voice" | "text";
};
const modes: Mode[] = [
  {
    key: "photo",
    label: "Take photo",
    icon: Camera,
    hint: "Photograph an item — the AI identifies brand, model and type.",
    kind: "file",
  },
  {
    key: "room",
    label: "Scan room",
    icon: DoorOpen,
    hint: "Photograph a whole room — every visible item becomes a record.",
    kind: "file",
  },
  {
    key: "receipt",
    label: "Scan receipt",
    icon: Receipt,
    hint: "Photograph a receipt or invoice — products, prices and warranties are extracted.",
    kind: "file",
  },
  {
    key: "document",
    label: "Upload document",
    icon: Upload,
    hint: "Upload a photo or PDF of a warranty, certificate, policy or manual.",
    kind: "file",
  },
  {
    key: "speak",
    label: "Speak",
    icon: Mic,
    hint: "Describe what you want to add — e.g. “I bought a Dyson V15 from Currys for £599 today”.",
    kind: "voice",
  },
  {
    key: "email",
    label: "Import email",
    icon: Mail,
    hint: "Paste an order confirmation or e-receipt email.",
    kind: "text",
  },
];
const sectionOptions = [
  "assets",
  "rooms",
  "documents",
  "warranties",
  "vehicles",
  "maintenance",
  "tasks",
  "insurance",
  "renewals",
  "services",
];

type Rec = Extracted & { keep: boolean };
type Step = "pick" | "capture" | "processing" | "review" | "saving" | "done";

async function toDataUrl(f: File, documentPhoto: boolean): Promise<string | undefined> {
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
    if (f.size > 5 * 1024 * 1024) throw new Error("PDF exceeds capture limit");
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unreadable PDF"));
      reader.onload = () =>
        resolve("data:application/pdf;base64," + String(reader.result).split(",")[1]);
      reader.readAsDataURL(f);
    });
  }
  if (!f.type.startsWith("image/")) return undefined;
  const img = await createImageBitmap(f, { imageOrientation: "from-image" });
  const scale = Math.min(1, (documentPhoto ? 2600 : 1600) / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return c.toDataURL("image/jpeg", documentPhoto ? 0.9 : 0.82);
}

async function videoFrames(f: File, count = 6): Promise<string[]> {
  const url = URL.createObjectURL(f);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((ok, bad) => {
      v.onloadeddata = () => ok();
      v.onerror = () => bad(new Error("video"));
    });
    const out: string[] = [];
    let previous: Uint8ClampedArray | undefined;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const d = isFinite(v.duration) ? v.duration : 1;
    for (let i = 0; i < count; i++) {
      v.currentTime = Math.min(d - 0.05, (d * (i + 0.5)) / count);
      await new Promise<void>((ok) => {
        v.onseeked = () => ok();
      });
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const pixels = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      if (!sameRoomFrame(previous, pixels)) {
        out.push(c.toDataURL("image/jpeg", 0.75));
        previous = pixels;
      }
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AddAnything({
  onClose,
  initial,
  review,
}: {
  onClose: () => void;
  initial?: string;
  review?: {
    id: string;
    title: string;
    proposals: Extracted[];
    provider: "google_mail" | "google_drive" | "outlook" | "onedrive";
  };
}) {
  const { reload, addReturning, added, current, update, properties } = useStore();
  const gate = usePlanGate();
  const [step, setStep] = useState<Step>(review ? "review" : initial ? "capture" : "pick");
  const [mode, setMode] = useState<Mode | undefined>(modes.find((m) => m.key === initial));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [summary, setSummary] = useState(review?.title ?? "");
  const [recs, setRecs] = useState<Rec[]>(
    review?.proposals.map((r) => ({ ...r, keep: true })) ?? [],
  );
  const [location, setLocation] = useState("");
  const [room, setRoom] = useState("");
  const [saved, setSaved] = useState<{ section: string; id: string; title: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const biz = current.type !== "individual";

  const selectedProperty = properties.find((p) => p.id === location || p.title === location);
  const rooms = (added["rooms"] ?? [])
    .filter((r) => !review || !selectedProperty || r.propertyId === selectedProperty.id)
    .map((r) => r.title);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Files must be under 20 MB");
      return;
    }
    if (/\.tiff?$/i.test(f.name) || f.type === "image/tiff") {
      try {
        f = await tiffToPng(f);
      } catch {
        toast.error("We couldn't open that TIFF image.");
        return;
      }
    }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined);
  };

  const recRef = useRef<MediaRecorder | null>(null);
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  useEffect(
    () => () => {
      const recorder = recRef.current;
      if (!recorder) return;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
      recRef.current = null;
    },
    [],
  );
  const listen = async () => {
    if (recRef.current) {
      recRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice input isn't supported in this browser — please type instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Please allow the microphone to speak.");
      return;
    }
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const recordingDeadline = setTimeout(() => {
      if (mr.state !== "inactive") mr.stop();
    }, 119000);
    mr.onstop = async () => {
      clearTimeout(recordingDeadline);
      stream.getTracks().forEach((t) => t.stop());
      recRef.current = null;
      setListening(false);
      const blob = new Blob(chunks, {
        type: (mr.mimeType || "audio/webm").replace("video/", "audio/"),
      });
      if (!blob.size) return;
      if (blob.size > 10 * 1024 * 1024) {
        toast.error("That recording is too long — please keep it under a few minutes.");
        return;
      }
      setTranscribing(true);
      try {
        const audioContext = new AudioContext();
        let buf: Uint8Array;
        try {
          const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
          const mono = new Float32Array(decoded.length);
          for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
            const samples = decoded.getChannelData(ch);
            for (let i = 0; i < mono.length; i++)
              mono[i] = (mono[i] ?? 0) + (samples[i] ?? 0) / decoded.numberOfChannels;
          }
          buf = encodeSpeechWav(mono, decoded.sampleRate);
        } finally {
          await audioContext.close();
        }
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000)
          bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const r = await transcribeToEnglish({
          data: {
            audio: btoa(bin),
            mime: "audio/wav",
            workspaceId: current.id,
          },
        });
        if ("error" in r && r.error) {
          if ("original" in r && r.original) setOriginalTranscript(r.original);
          toast.error(r.error);
        } else if ("english" in r && r.english) {
          setOriginalTranscript(r.original);
          setText((t) => (t ? t + " " : "") + r.english);
        }
      } catch {
        toast.error("We couldn't understand that recording. Please try again.");
      } finally {
        setTranscribing(false);
      }
    };
    recRef.current = mr;
    setListening(true);
    mr.start();
  };

  const process = async () => {
    if (!mode) return;
    if (mode.kind === "file" && !file) {
      toast.error("Please choose a photo or file first");
      return;
    }
    if (mode.kind !== "file" && !text.trim() && !(mode.key === "email" && file)) {
      toast.error("Please add some text first");
      return;
    }
    setStep("processing");
    try {
      const isVideo = !!file?.type.startsWith("video/");
      let docText: string | null = null;
      if (file && !isVideo) {
        try {
          docText = await extractFileText(file);
        } catch {
          toast.error(
            "That file type can't be read yet. Please save it as PDF, DOCX, XLSX, PPTX or an image.",
          );
          setStep("capture");
          return;
        }
      }
      if (docText !== null && !docText.trim()) {
        toast.error("No readable text was found in that file.");
        setStep("capture");
        return;
      }
      const image =
        file && !isVideo && docText === null
          ? await toDataUrl(file, /receipt|document|invoice/i.test(mode.label))
          : undefined;
      const images = file && isVideo ? await videoFrames(file) : undefined;
      const referenceDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the user's locale calendar
      const r = await extractRecords({
        data: {
          workspaceId: current.id,
          mode: mode.label,
          referenceDate,
          text:
            docText !== null ? `${text}\n\nDocument content:\n${docText}`.slice(0, 60000) : text,
          image,
          images,
          fileName: file?.name,
        },
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        setStep("capture");
        return;
      }
      if (!("records" in r) || !r.records?.length) {
        toast.error("Nothing recognisable was found. Try a clearer photo or add a note.");
        setStep("capture");
        return;
      }
      setSummary(r.summary);
      // Server already normalises spoken dates + derives expiry/renewal; keep a client pass for safety.
      setRecs(
        r.records.map((x) => ({
          ...x,
          fields: deriveContractDates(
            x.fields.map((f) => [f.label, f.value] as [string, string]),
            x.section === "warranties" ? "Expiry date" : "Renewal date",
            referenceDate,
          ).map(([label, value]) => ({ label, value })),
          keep: true,
        })),
      );
      setStep("review");
    } catch {
      toast.error("Processing failed. Please try again.");
      setStep("capture");
    }
  };

  const save = async () => {
    const keep = recs.filter((r) => r.keep && r.title.trim());
    if (!keep.length) {
      toast.error("Select at least one record");
      return;
    }
    if (review) {
      setStep("saving");
      try {
        const saved = await decideReview({
          data: {
            id: review.id,
            workspaceId: current.id,
            connector: review.provider,
            property: selectedProperty?.id ?? null,
            room,
            records: keep,
            reject: false,
          },
        });
        await reload();
        setSaved(saved);
        setStep("done");
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Couldn't save these records. Check the property and room, then retry.",
        );
        setStep("review");
      }
      return;
    }
    const hash = file ? await fileHash(file) : "";
    const docs = added["documents"] ?? [];
    const fv = (i: { fields: [string, string][] }, k: string) =>
      i.fields.find(([l]) => l.toLowerCase() === k.toLowerCase())?.[1]?.trim() ?? "";
    const dup = hash && docs.find((d) => fv(d, "File fingerprint") === hash);
    if (dup && !confirm(`This file was already uploaded as “${dup.title}”. Save it again anyway?`))
      return;
    setStep("saving");
    let previous: (typeof docs)[number] | undefined;
    const out: ((typeof saved)[number] & { rel: string })[] = [];
    const doc = keep.find((r) => r.section === "documents");
    const SHARED =
      /^(invoice|receipt|order|reference|issue date|due date|supplier|service provider|provider|retailer|vendor|merchant|seller|bill to|email|telephone|phone|address|supplier (email|telephone|phone|address))/i;
    const shared = doc
      ? doc.fields.filter((f) => SHARED.test(f.label.trim()) && f.value.trim())
      : [];
    for (const r of keep) {
      const fields: [string, string][] = r.fields.map((f) => [f.label, f.value]);
      if (doc && r !== doc) {
        for (const f of shared)
          if (!fields.some(([k]) => k.toLowerCase() === f.label.toLowerCase()))
            fields.push([f.label, f.value]);
        fields.push(["Source document", doc.title.trim()]);
      }
      if (r === doc) {
        if (hash) fields.push(["File fingerprint", hash]);
        const ref = r.fields
          .find((f) => /^(reference|contract reference)$/i.test(f.label))
          ?.value.trim()
          .toLowerCase();
        previous = docs.find(
          (d) =>
            d !== dup &&
            !/^superseded$/i.test(fv(d, "Status")) &&
            ((ref && fv(d, "Reference").toLowerCase() === ref) ||
              d.title.trim().toLowerCase() === r.title.trim().toLowerCase()),
        );
        if (previous)
          fields.push(
            ["Version", String((Number(fv(previous, "Version")) || 1) + 1)],
            ["Previous version", previous.title],
          );
      }
      if (selectedProperty) fields.push(["Location", selectedProperty.title]);
      else if (location) fields.push(["Location", location]);
      if (room && !fields.some(([k]) => k === "Room")) fields.push(["Room", room]);
      fields.push(["Captured via", mode?.label ?? "Add anything"]);
      const id = await addReturning(r.section, {
        id: "",
        title: r.title.trim(),
        subtitle: r.subtitle,
        fields,
        propertyId: selectedProperty?.id ?? null,
      });
      if (id) out.push({ section: r.section, id, title: r.title, rel: r.relates_to ?? "" });
    }
    const newDoc = doc && out.find((o) => o.section === "documents");
    if (previous && newDoc) {
      const pf = previous.fields.filter(([k]) => !/^(status|replaced by)$/i.test(k));
      await update(previous.id, {
        ...previous,
        fields: [...pf, ["Status", "Superseded"], ["Replaced by", newDoc.title]],
      });
      await supabase.from("record_links").insert({
        source_item_id: newDoc.id,
        target_item_id: previous.id,
        relationship_type: "SUPERSEDES",
        source_document_id: newDoc.id,
        source_capture_type: mode?.label ?? "Add anything",
        workspace_id: current.id,
      });
    }
    await linkCaptured(out, mode?.label ?? "Add anything", current.id);
    if (file && out[0]) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        for (const rec of [newDoc || out[0]]) {
          if (!rec) continue;
          const path = `${u.user.id}/${rec.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
          const { error } = await supabase.storage
            .from("evidence")
            .upload(path, file, { contentType: file.type });
          if (error) {
            toast.error("Records saved, but the attachment upload failed. Add it from Evidence.");
            continue;
          }
          const metadata = await supabase
            .from("evidence_files")
            .insert({ item_id: rec.id, path, name: file.name, mime: file.type, size: file.size });
          if (metadata.error) {
            const cleanup = await supabase.storage.from("evidence").remove([path]);
            toast.error(
              cleanup.error
                ? "Attachment could not be registered or removed. Contact support."
                : "Records saved, but the attachment could not be registered. Add it from Evidence.",
            );
          }
        }
      }
    }
    setSaved(out.map(({ rel: _r, ...x }) => x));
    if (out.length < keep.length)
      toast.error(`${keep.length - out.length} record(s) couldn't be saved`);
    setStep("done");
  };

  const steps: Step[] = ["capture", "processing", "review", "done"];
  const idx = steps.indexOf(step === "saving" ? "review" : step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-rise flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-7 py-5">
          <div className="flex items-center gap-3">
            {step === "capture" && (
              <button
                aria-label="Back"
                onClick={() => {
                  setStep("pick");
                  setFile(null);
                  setText("");
                  setOriginalTranscript("");
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h3 className="font-display text-2xl">
              {mode && step !== "pick" ? mode.label : "Add anything"}
            </h3>
          </div>
          <button aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {step !== "pick" && (
          <div className="flex gap-2 px-7 pt-4">
            {["Capture", "AI reading", "Review", "Saved"].map((l, i) => (
              <div key={l} className="flex-1">
                <div className={`h-1 rounded-full ${i <= idx ? "bg-aurora" : "bg-secondary"}`} />
                <p
                  className={`mt-1 text-xs ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {l}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-7">
          {step === "pick" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {modes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => {
                    const f = modeFeature[m.key];
                    if (f && !gate.need(f[0], f[1])) return;
                    setMode(m);
                    setStep("capture");
                  }}
                  className="relative flex flex-col items-center gap-2 rounded-2xl border p-5 text-sm font-medium transition hover:border-primary hover:bg-secondary"
                >
                  {modeFeature[m.key] && !gate.can(modeFeature[m.key]![0]) && (
                    <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <m.icon className="h-6 w-6 text-primary" />
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {step === "capture" && mode && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{mode.hint}</p>
              {(mode.kind === "file" || mode.key === "email") && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className="grid min-h-48 cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-6 text-center hover:border-primary"
                >
                  {preview ? (
                    <img src={preview} alt="Selected" className="max-h-64 rounded-xl" />
                  ) : file ? (
                    <p className="font-medium">{file.name}</p>
                  ) : (
                    <div>
                      <mode.icon className="mx-auto h-8 w-8 text-primary" />
                      <p className="mt-2 text-sm font-medium">
                        {mode.key === "email"
                          ? "Choose an email attachment"
                          : "Tap to take a photo or choose a file"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Photos, short videos or PDF, up to 20 MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={
                      mode.key === "document" || mode.key === "email"
                        ? DOC_ACCEPT
                        : "image/*,video/*"
                    }
                    capture={
                      mode.key === "document" || mode.key === "email" ? undefined : "environment"
                    }
                    className="hidden"
                    onChange={(e) => void pickFile(e.target.files?.[0])}
                  />
                </div>
              )}
              {mode.kind === "voice" && (
                <>
                  <div className="block text-sm">
                    Spoken language
                    <span className="ml-2 inline-block rounded border bg-background p-2">
                      Detect automatically
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={listen}
                    disabled={transcribing}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-6 text-sm font-semibold ${listening || transcribing ? "animate-pulse border-primary text-primary" : ""}`}
                  >
                    <Mic className="h-5 w-5" />
                    {transcribing
                      ? "Translating to English…"
                      : listening
                        ? "Listening… tap to finish"
                        : "Tap and speak"}
                  </button>
                  {originalTranscript && (
                    <details className="text-sm">
                      <summary>Original transcript</summary>
                      <p>{originalTranscript}</p>
                    </details>
                  )}
                </>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={mode.kind === "file" ? 2 : 6}
                maxLength={8000}
                placeholder={
                  mode.kind === "file"
                    ? "Optional note, e.g. “bought in 2024, kitchen”"
                    : mode.kind === "voice"
                      ? "Your words appear here — you can also type."
                      : "Paste the email here"
                }
                className="w-full rounded-2xl border bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {mode.kind === "file" && file && !file.type.startsWith("image/") && (
                <p className="text-xs text-muted-foreground">
                  MatrixKeep reads the supported file and your note. Review extracted records before
                  saving.
                </p>
              )}
              <button
                onClick={process}
                className="w-full rounded-full bg-aurora py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Let the AI read it
              </button>
            </div>
          )}

          {step === "processing" && (
            <div className="py-12 text-center">
              <Bot className="mx-auto h-10 w-10 animate-pulse text-primary" />
              <p className="mt-4 font-semibold">Your capture agent is reading this…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Identifying items, prices, dates and warranties.
              </p>
              <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {(step === "review" || step === "saving") && (
            <div className="space-y-4">
              <p className="rounded-2xl bg-secondary p-4 text-sm">{summary}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {biz ? "Location" : "Property"}
                  <select
                    aria-label={biz ? "Location" : "Property"}
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      if (review) setRoom("");
                    }}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">
                      {properties.length
                        ? `Choose ${biz ? "location" : "property"}`
                        : `No ${biz ? "locations" : "properties"} yet`}
                    </option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Room
                  <select
                    aria-label="Room"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Not set</option>
                    {[...new Set(rooms)].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>
              {recs.map((r, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${r.keep ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={r.keep}
                      onChange={(e) =>
                        setRecs((x) =>
                          x.map((y, j) => (j === i ? { ...y, keep: e.target.checked } : y)),
                        )
                      }
                      aria-label="Include"
                    />
                    <input
                      value={r.title}
                      onChange={(e) =>
                        setRecs((x) =>
                          x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)),
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold"
                    />
                    <select
                      value={r.section}
                      onChange={(e) =>
                        setRecs((x) =>
                          x.map((y, j) =>
                            j === i ? { ...y, section: e.target.value as Rec["section"] } : y,
                          ),
                        )
                      }
                      className="rounded-lg border bg-background px-2 py-1.5 text-xs"
                    >
                      {sectionOptions.map((s) => (
                        <option key={s} value={s}>
                          {getSection(s)?.title ?? s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {r.subtitle && <p className="mt-2 text-xs text-muted-foreground">{r.subtitle}</p>}
                  {isAutoRenew(r.fields.map((f) => [f.label, f.value])) && (
                    <p className="mt-2 rounded-xl bg-warning/15 px-3 py-2 text-xs font-medium">
                      Auto-renewal detected — this agreement may renew automatically unless action
                      is taken
                      {(() => {
                        const d = noticeDeadline(r.fields.map((f) => [f.label, f.value]));
                        return d
                          ? ` before ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                          : "";
                      })()}
                      .
                    </p>
                  )}
                  {/^needs review|^low/i.test(
                    r.fields.find((f) => /confidence/i.test(f.label))?.value ?? "",
                  ) && (
                    <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-xs">
                      Needs review — please check the dates before saving.
                    </p>
                  )}
                  {r.fields.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {r.fields.map((f, fi) => (
                        <div key={f.label} className="flex gap-1">
                          <dt className="text-muted-foreground">{f.label}:</dt>
                          <dd className="min-w-0 font-medium">
                            {review ? (
                              <input
                                aria-label={f.label}
                                value={f.value}
                                className="w-full rounded border bg-background px-1"
                                onChange={(e) =>
                                  setRecs((list) =>
                                    list.map((row, j) =>
                                      j === i
                                        ? {
                                            ...row,
                                            fields: row.fields.map((field, k) =>
                                              k === fi
                                                ? { ...field, value: e.target.value }
                                                : field,
                                            ),
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              f.value
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
              <button
                disabled={step === "saving"}
                onClick={save}
                className="w-full rounded-full bg-aurora py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {step === "saving"
                  ? "Saving…"
                  : `Save ${recs.filter((r) => r.keep).length} record(s)`}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <Check className="mx-auto h-10 w-10 text-success" />
              <p className="font-display text-2xl">Saved to {current.name}</p>
              {file && (
                <p className="text-sm text-muted-foreground">
                  The original file is attached as evidence to each record.
                </p>
              )}
              <div className="space-y-2 text-left">
                {saved.map((s) => {
                  const sec = sections.find((x) => x.slug === s.section);
                  return (
                    <Link
                      key={s.id}
                      to="/app/$section/$id"
                      params={{ section: s.section, id: s.id }}
                      onClick={onClose}
                      className="flex items-center justify-between rounded-2xl border p-3 text-sm hover:border-primary"
                    >
                      <span className="font-medium">{s.title}</span>
                      <span className="text-xs text-muted-foreground">{sec?.title}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStep("pick");
                    setFile(null);
                    setText("");
                    setOriginalTranscript("");
                    setRecs([]);
                  }}
                  className="flex-1 rounded-full border py-3 text-sm font-semibold"
                >
                  Add more
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SR = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void;
  onend: () => void;
};

const REL: Record<string, string> = {
  maintenance: "MAINTENANCE_FOR",
  warranties: "WARRANTY_FOR",
  insurance: "INSURANCE_FOR",
  tasks: "TASK_FOR",
  renewals: "RENEWAL_FOR",
};
/** Persist the relationship graph for records created from one capture. */
async function linkCaptured(
  out: { section: string; id: string; title: string; rel: string }[],
  captureType: string,
  workspaceId: string | null,
) {
  if (out.length < 2) return;
  const extraction = crypto.randomUUID();
  const doc = out.find((o) => o.section === "documents");
  const rows: {
    source_item_id: string;
    target_item_id: string;
    relationship_type: string;
    source_document_id: string | null;
    source_extraction_id: string;
    source_capture_type: string;
    workspace_id: string | null;
  }[] = [];
  const base = {
    source_document_id: doc?.id ?? null,
    source_extraction_id: extraction,
    source_capture_type: captureType,
    workspace_id: workspaceId,
  };
  for (const o of out) {
    if (doc && o.id !== doc.id)
      rows.push({
        ...base,
        source_item_id: o.id,
        target_item_id: doc.id,
        relationship_type: "EXTRACTED_FROM",
      });
    const parent =
      o.rel &&
      out.find((p) => p.id !== o.id && p.title.trim().toLowerCase() === o.rel.trim().toLowerCase());
    if (parent)
      rows.push({
        ...base,
        source_item_id: o.id,
        target_item_id: parent.id,
        relationship_type: REL[o.section] ?? "RELATED_TO",
      });
  }
  if (!doc)
    for (const o of out.slice(1))
      if (!rows.some((r) => r.source_item_id === o.id))
        rows.push({
          ...base,
          source_item_id: o.id,
          target_item_id: out[0]!.id,
          relationship_type: "SAME_SOURCE",
        });
  if (rows.length) await supabase.from("record_links").insert(rows);
}
