import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X } from "lucide-react";
import { askSera } from "@/lib/sera.functions";

type Msg = { role: "user" | "assistant"; content: string };

export function Sera() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next); setQ(""); setBusy(true);
    try {
      const r = await askSera({ data: { messages: next.slice(-20) } });
      setMsgs([...next, { role: "assistant", content: r.reply || r.error || "No answer." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Sera couldn't answer just now." }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Ask Sera" className="fixed bottom-24 right-4 z-40 lg:bottom-6 lg:right-6 flex items-center gap-2 rounded-full bg-aurora px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
          <Sparkles className="h-4 w-4" /> Ask Sera
        </button>
      )}
      {open && (
        <div className="animate-rise fixed bottom-6 right-6 z-50 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border bg-card shadow-glow">
          <div className="flex items-center justify-between bg-midnight-glow px-5 py-4 text-midnight-foreground">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /><div><p className="font-semibold">Sera</p><p className="text-xs text-midnight-foreground/60">Your AI household manager</p></div></div>
            <button aria-label="Close Sera" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && <p className="rounded-2xl bg-secondary p-3 text-muted-foreground">Hi, I'm Sera. Ask me about anything you've saved — receipts, warranties, rooms, vehicles or locations.</p>}
            {msgs.map((m, i) => (
              <p key={i} className={`whitespace-pre-wrap rounded-2xl p-3 ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-secondary"}`}>{m.content}</p>
            ))}
            {busy && <p className="mr-8 animate-pulse rounded-2xl bg-secondary p-3 text-muted-foreground">Sera is thinking…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where's the receipt for the TV?" className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button disabled={busy} aria-label="Send" className="grid h-9 w-9 place-items-center rounded-full bg-aurora text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      )}
    </>
  );
}
