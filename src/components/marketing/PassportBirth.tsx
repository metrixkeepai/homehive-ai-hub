import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Receipt, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photos } from "./media";

/** Illustrative, scroll-scrubbed story. State follows scroll position in both directions. */
const stages = [
  "It starts with what you own.",
  "The details are already there.",
  "Turn information into understanding.",
  "Everything finds its place.",
  "One asset. Its entire story.",
  "Know what matters. Know what's next.",
];
const bounds = [0, 0.15, 0.3, 0.5, 0.7, 0.9];

export function stageFor(progress: number) {
  let s = 0;
  bounds.forEach((b, i) => {
    if (progress >= b) s = i;
  });
  return s;
}

export function PassportBirth() {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setP(1);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(Math.max(0, Math.min(1, -r.top / Math.max(1, total))));
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  const stage = stageFor(p);
  return (
    <section ref={ref} className="mk-birth" data-stage={stage} aria-labelledby="mk-birth-title">
      <div className="mk-birth-sticky">
        <div className="mk-container mk-birth-grid">
          <div className="mk-birth-copy">
            <p className="mk-birth-eyebrow">The birth of a Digital Passport</p>
            <h2 id="mk-birth-title">An ordinary asset. An extraordinary digital memory.</h2>
            <p className="mk-birth-lead">See what happens when everything about an asset comes together.</p>
            <ol className="mk-birth-steps">
              {stages.map((s, i) => (
                <li key={s} aria-current={i === stage ? "step" : undefined} data-done={i < stage}>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mk-birth-caption" aria-live="polite">{stages[stage]}</p>
            <Button asChild size="lg" className="mk-birth-cta">
              <Link to="/auth">
                Create Your First Digital Passport <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mk-birth-stage" aria-hidden="true">
            <svg className="mk-birth-lines" viewBox="0 0 400 400" preserveAspectRatio="none">
              <path d="M200 200 L60 70" /><path d="M200 200 L345 80" />
              <path d="M200 200 L50 320" /><path d="M200 200 L350 320" />
            </svg>
            <div className="mk-birth-asset">
              <img src={photos.coffee} alt="" loading="lazy" />
              <span>Commercial espresso machine</span>
            </div>
            <div className="mk-birth-doc d1"><Receipt className="size-4" /><b>Purchase receipt</b><em>£4,800 · 12 Mar 2025</em></div>
            <div className="mk-birth-doc d2"><FileText className="size-4" /><b>Supplier invoice</b><em>Model EC-900 · Serial 4471</em></div>
            <div className="mk-birth-doc d3"><ShieldCheck className="size-4" /><b>Warranty</b><em>Valid until Mar 2027</em></div>
            <div className="mk-birth-doc d4"><Wrench className="size-4" /><b>Service record</b><em>Descale due January</em></div>
            <div className="mk-birth-fields">
              <span><i>Product</i>Espresso machine EC-900</span>
              <span><i>Price</i>£4,800</span>
              <span><i>Purchased</i>12 March 2025</span>
              <span><i>Evidence</i>3 documents</span>
            </div>
            <div className="mk-birth-passport">
              <b>Digital Passport</b>
              <span>Espresso machine · Café floor</span>
              <span>4 records connected · Verified evidence</span>
            </div>
            <div className="mk-birth-sera">
              <Sparkles className="size-4" />
              <p>Warranty covers the steam wand until March 2027. Book the descale before January to keep cover valid.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StoryBridge({ children }: { children: string }) {
  return (
    <div className="mk-bridge" role="presentation">
      <p>{children}</p>
    </div>
  );
}
