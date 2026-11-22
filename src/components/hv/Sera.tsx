import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Sparkles, Send, X, Mic, PhoneOff } from "lucide-react";
import { useLiveVoice } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "./store";
import { askSera } from "@/lib/sera.functions";

type Msg = {
  role: "user" | "assistant";
  content: string;
  refs?: { id: string; section: string; title: string }[];
};

export function Sera() {
  const { current } = useStore();
  const route = useLocation();
  const propertyId =
    route.pathname.match(/^\/app\/(?:my-home|locations)\/([0-9a-f-]{36})(?:\/|$)/i)?.[1] ?? null;
  const scopeKey = current.id + ":" + propertyId;
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const call = useLiveVoice({
    propertyId,
    workspaceId: current.id,
    getToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
  });
  const inCall =
    call.status === "connecting" || call.status === "connected" || call.status === "stopping";
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    setMsgs([]);
    setQ("");
    call.stop();
  }, [current.id, propertyId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setQ("");
    setBusy(true);
    try {
      const r = await askSera({
        data: { workspaceId: current.id, propertyId, messages: next.slice(-12) },
      });
      if (activeScope.current !== scopeKey) return;
      setMsgs([
        ...next,
        {
          role: "assistant",
          refs: "refs" in r ? r.refs : [],
          content: ("reply" in r ? r.reply : r.error) || "No answer.",
        },
      ]);
    } catch {
      if (activeScope.current !== scopeKey) return;
      setMsgs([...next, { role: "assistant", content: "Sera couldn't answer just now." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <audio ref={call.audioRef} className="hidden" />
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Sera"
          className="fixed bottom-24 right-4 z-40 lg:bottom-6 lg:right-6 flex items-center gap-2 rounded-full bg-aurora px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Sparkles className="h-4 w-4" /> Ask Sera
        </button>
      )}
      {open && (
        <div className="animate-rise fixed bottom-6 right-6 z-50 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border bg-card shadow-glow">
          <div className="flex items-center justify-between bg-midnight-glow px-5 py-4 text-midnight-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="font-semibold">Sera</p>
                <p className="text-xs text-midnight-foreground/60">Your AI household manager</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {inCall ? (
                <button
                  aria-label="End voice call"
                  onClick={call.stop}
                  className="flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"
                >
                  <PhoneOff className="h-3.5 w-3.5" /> End
                </button>
              ) : (
                <button
                  aria-label="Talk to Sera"
                  onClick={call.start}
                  className="flex items-center gap-1 rounded-full bg-midnight-foreground/15 px-3 py-1 text-xs font-semibold"
                >
                  <Mic className="h-3.5 w-3.5" /> Talk
                </button>
              )}
              <button
                aria-label="Close Sera"
                onClick={() => {
                  call.stop();
                  setOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {(inCall || call.error) && (
            <div className="border-b bg-secondary px-4 py-2 text-xs">
              {call.error ? (
                <span className="text-destructive">{call.error}</span>
              ) : call.status === "connecting" ? (
                "Connecting… allow the microphone when asked."
              ) : call.status === "stopping" ? (
                "Ending call…"
              ) : (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Listening —
                  speak in any language{call.muted ? " (muted)" : ""}.
                </span>
              )}
              {call.status === "connected" && (
                <button className="ml-2 underline" onClick={() => call.setMuted(!call.muted)}>
                  {call.muted ? "Unmute" : "Mute"}
                </button>
              )}
              {call.playbackBlocked && (
                <button className="ml-2 underline" onClick={call.resumePlayback}>
                  Play Sera's voice
                </button>
              )}
            </div>
          )}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <p className="rounded-2xl bg-secondary p-3 text-muted-foreground">
                Hi, I'm Sera. Ask me about anything you've saved — receipts, warranties, rooms,
                vehicles or locations.
              </p>
            )}
            {msgs.map((m, i) => (
              <p
                key={i}
                className={`whitespace-pre-wrap rounded-2xl p-3 ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-secondary"}`}
              >
                {m.content}
                {m.refs?.map((ref) => (
                  <Link
                    className="block text-xs text-primary underline"
                    key={ref.id}
                    to="/app/$section/$id"
                    params={{ section: ref.section, id: ref.id }}
                  >
                    {ref.title}
                  </Link>
                ))}
              </p>
            ))}
            {busy && (
              <p className="mr-8 animate-pulse rounded-2xl bg-secondary p-3 text-muted-foreground">
                Sera is thinking…
              </p>
            )}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Where's the receipt for the TV?"
              className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              disabled={busy}
              aria-label="Send"
              className="grid h-9 w-9 place-items-center rounded-full bg-aurora text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
