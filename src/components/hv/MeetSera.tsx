import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Reveal } from "@/components/hv/Site";

const convo: [string, string][] = [
  [
    "Which warranties end this year?",
    "Three: your dishwasher (12 May), laptop (3 Aug) and TV extended cover (19 Nov). Want reminders a month before each?",
  ],
  [
    "What's due at the Leeds site?",
    "The fire alarm inspection is due in 9 days and the chiller service contract renews on 1 Nov.",
  ],
  [
    "Am I ready to claim for my bike?",
    "Yes — you have the receipt, 4 photos and the frame number. Evidence strength is 94%.",
  ],
];

export function MeetSera() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % convo.length), 5000);
    return () => clearInterval(t);
  }, []);
  const [q, a] = convo[i]!;
  return (
    <section className="bg-midnight-glow text-midnight-foreground">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-28 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-aurora">Meet Sera</p>
          <h2 className="mt-3 font-display text-4xl font-medium md:text-5xl">
            Your AI keeper — who actually knows your things.
          </h2>
          <p className="mt-5 max-w-lg text-midnight-foreground/70">
            Sera answers using only the records you've saved: what you own, where it is, what's
            covered and what's coming up. Ask in plain words, get a clear answer and a next step.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-aurora px-7 py-3.5 font-semibold text-primary-foreground shadow-glow"
          >
            Try Sera free
          </Link>
        </Reveal>
        <Reveal delay={150}>
          <div className="relative mx-auto max-w-md">
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-aurora opacity-20 blur-3xl animate-float" />
            <div className="relative rounded-3xl border border-midnight-foreground/15 bg-midnight/85 p-6 shadow-glow backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="relative grid h-10 w-10 place-items-center rounded-full bg-aurora">
                  <span className="absolute inset-0 rounded-full bg-aurora animate-pulse-ring" />
                  <Sparkles className="relative h-5 w-5 text-primary-foreground" />
                </span>
                <div>
                  <p className="font-semibold">Sera</p>
                  <p className="text-xs text-midnight-foreground/60">Watching 214 records</p>
                </div>
              </div>
              <div key={i} className="mt-6 space-y-3">
                <p className="animate-rise ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-midnight-foreground/10 px-4 py-2.5 text-sm">
                  {q}
                </p>
                <p className="animate-rise max-w-[90%] rounded-2xl rounded-bl-sm bg-aurora/15 px-4 py-2.5 text-sm [animation-delay:700ms]">
                  {a}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
