import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Receipt, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "./motion";

/** One scroll-scrubbed story: state follows normalized scroll progress forwards and backwards. */
export type ScrollStoryData = {
  eyebrow: string;
  title: string;
  lead: string;
  captions: string[];
  image: string;
  asset: string;
  docs: [string, string][];
  fields: [string, string][];
  passport: [string, string];
  insight: string;
  nodes?: string[];
  cta: { label: string; to: "/auth" | "/pricing" | "/contact" | "/partners" | "/business" };
  tone?: "dark" | "light";
};

export function stageFor(progress: number, count: number) {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}

const icons = [Receipt, FileText, ShieldCheck, Wrench];

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    if (window.matchMedia(motion.reducedQuery).matches) {
      setP(1);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight);
      setP(Math.max(0, Math.min(1, -r.top / total)));
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
  return [ref, p] as const;
}

export function ScrollStory({ data }: { data: ScrollStoryData }) {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const n = data.captions.length;
  const stage = stageFor(p, n);
  // Stage milestones scale to the number of captions (4 or 6).
  const at = (fraction: number) => p >= fraction;
  const id = `mk-story-${data.title.replace(/[^a-z]/gi, "").slice(0, 24)}`;
  return (
    <section
      ref={ref}
      className={`mk-birth mk-story ${data.tone === "light" ? "is-light" : ""}`}
      data-docs={at(0.16)}
      data-fields={at(0.3) && !at(0.7)}
      data-lines={at(0.5)}
      data-passport={at(0.7)}
      data-sera={at(0.88)}
      data-nodes={Boolean(data.nodes) && at(0.8)}
      style={{ ["--sp" as string]: p.toFixed(3) }}
      aria-labelledby={id}
    >
      <div className="mk-birth-sticky">
        <div className="mk-birth-grid">
          <div className="mk-birth-copy">
            <p className="mk-birth-eyebrow">{data.eyebrow}</p>
            <h2 id={id}>{data.title}</h2>
            <p className="mk-birth-lead">{data.lead}</p>
            <ol className="mk-birth-steps">
              {data.captions.map((s, i) => (
                <li key={s} aria-current={i === stage ? "step" : undefined} data-done={i < stage}>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mk-birth-caption" key={stage}>
              {data.captions[stage]}
            </p>
            <div className="mk-story-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${p})` }} />
            </div>
            <Button asChild size="lg" className="mk-birth-cta">
              <Link to={data.cta.to}>
                {data.cta.label} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mk-birth-stage" aria-hidden="true">
            <svg className="mk-birth-lines" viewBox="0 0 400 400" preserveAspectRatio="none">
              <path d="M200 200 L60 70" />
              <path d="M200 200 L345 80" />
              <path d="M200 200 L50 320" />
              <path d="M200 200 L350 320" />
            </svg>
            <div className="mk-birth-asset">
              <img src={data.image} alt="" loading="lazy" />
              <span>{data.asset}</span>
              <i className="mk-story-scan" />
            </div>
            {data.docs.slice(0, 4).map(([t, d], i) => {
              const Icon = icons[i] ?? FileText;
              return (
                <div key={t} className={`mk-birth-doc d${i + 1}`}>
                  <Icon className="size-4" />
                  <b>{t}</b>
                  <em>{d}</em>
                </div>
              );
            })}
            <div className="mk-birth-fields">
              {data.fields.slice(0, 4).map(([k, v]) => (
                <span key={k}>
                  <i>{k}</i>
                  {v}
                </span>
              ))}
            </div>
            <div className="mk-birth-passport">
              <b>{data.passport[0]}</b>
              <span>{data.passport[1]}</span>
              <small>Illustrative record</small>
            </div>
            {data.nodes && (
              <div className="mk-story-nodes">
                {data.nodes.map((x, i) => (
                  <span key={x} style={{ ["--i" as string]: i }}>
                    {x}
                  </span>
                ))}
              </div>
            )}
            <div className="mk-birth-sera">
              <Sparkles className="size-4" />
              <p>
                <strong>Sera · </strong>
                {data.insight}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StoryBridge({ children }: { children: string }) {
  return (
    <div className="mk-bridge">
      <p>
        {children.split(" ").map((w, i) => (
          <span key={i} style={{ ["--w" as string]: i }}>
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}
