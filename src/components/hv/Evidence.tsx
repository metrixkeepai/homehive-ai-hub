import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, X, Download, Trash2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Ev = { id: string; path: string; name: string; mime: string; size: number; created_at: string; url?: string };

export function Evidence({ itemId }: { itemId: string }) {
  const [files, setFiles] = useState<Ev[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Ev | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("evidence_files").select("*").eq("item_id", itemId).order("created_at", { ascending: false });
    const rows = (data ?? []) as Ev[];
    if (rows.length) {
      const { data: signed } = await supabase.storage.from("evidence").createSignedUrls(rows.map((r) => r.path), 3600);
      rows.forEach((r, i) => { r.url = signed?.[i]?.signedUrl ?? ""; });
    }
    setFiles(rows);
  }, [itemId]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setBusy(true);
    for (const f of Array.from(list)) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} is over 20 MB`); continue; }
      const path = `${u.user.id}/${itemId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("evidence").upload(path, f, { contentType: f.type });
      if (error) { toast.error(`Couldn't upload ${f.name}`); continue; }
      await supabase.from("evidence_files").insert({ item_id: itemId, path, name: f.name, mime: f.type, size: f.size });
    }
    setBusy(false);
    toast.success("Evidence saved");
    void load();
  };

  const del = async (e: Ev) => {
    await supabase.storage.from("evidence").remove([e.path]);
    await supabase.from("evidence_files").delete().eq("id", e.id);
    setOpen(null); toast.success("Deleted"); void load();
  };

  const isImg = (e: Ev) => e.mime.startsWith("image/");
  const isPdf = (e: Ev) => e.mime === "application/pdf";

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
        className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center"
      >
        <Upload className="h-6 w-6 text-primary" />
        <p className="text-sm font-medium">Drop photos, receipts or PDFs here</p>
        <button disabled={busy} onClick={() => input.current?.click()} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Uploading…" : "Choose files"}
        </button>
        <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      </div>

      {files.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No evidence yet.</p> : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {files.map((f) => (
            <button key={f.id} onClick={() => { setOpen(f); setZoom(1); setRot(0); }} className="group overflow-hidden rounded-2xl border text-left transition hover:border-primary">
              <div className="grid aspect-square place-items-center bg-secondary">
                {isImg(f) && f.url ? <img src={f.url} alt={f.name} className="h-full w-full object-cover" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
              </div>
              <p className="truncate px-3 py-2 text-xs font-medium">{f.name}</p>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-midnight/90 p-4" onClick={() => setOpen(null)}>
          <div className="flex items-center gap-2 text-midnight-foreground" onClick={(e) => e.stopPropagation()}>
            <p className="flex-1 truncate font-medium">{open.name} <span className="text-xs opacity-60">· {(open.size / 1024).toFixed(0)} KB · {new Date(open.created_at).toLocaleDateString()}</span></p>
            {isImg(open) && <>
              <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded-full p-2 hover:bg-midnight-foreground/10"><ZoomOut className="h-5 w-5" /></button>
              <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded-full p-2 hover:bg-midnight-foreground/10"><ZoomIn className="h-5 w-5" /></button>
              <button aria-label="Rotate" onClick={() => setRot((r) => r + 90)} className="rounded-full p-2 hover:bg-midnight-foreground/10"><RotateCw className="h-5 w-5" /></button>
            </>}
            <a aria-label="Download" href={open.url} download={open.name} target="_blank" rel="noreferrer" className="rounded-full p-2 hover:bg-midnight-foreground/10"><Download className="h-5 w-5" /></a>
            <button aria-label="Delete" onClick={() => void del(open)} className="rounded-full p-2 hover:bg-midnight-foreground/10"><Trash2 className="h-5 w-5" /></button>
            <button aria-label="Close" onClick={() => setOpen(null)} className="rounded-full p-2 hover:bg-midnight-foreground/10"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-4 grid flex-1 place-items-center overflow-auto" onClick={(e) => e.stopPropagation()}>
            {isImg(open) && <img src={open.url} alt={open.name} style={{ transform: `scale(${zoom}) rotate(${rot}deg)` }} className="max-h-full max-w-full transition-transform" />}
            {isPdf(open) && <iframe src={open.url} title={open.name} className="h-full w-full rounded-xl bg-card" />}
            {!isImg(open) && !isPdf(open) && <p className="text-midnight-foreground">Preview not available — use download.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
