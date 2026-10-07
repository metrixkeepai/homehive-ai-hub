import { useEffect, useRef, useState } from "react";
import { Receipt, ShieldCheck, Bell, Sparkles, MapPin, Barcode, Umbrella, Wrench, Check } from "lucide-react";
import tv from "@/assets/passport-tv.jpg";

const STEPS = 8;

/** Animated Digital Passport: builds itself step by step, then loops. */
export function HeroPassport() {
  const [s, setS] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setS((v) => (v + 1) % (STEPS + 2)), 1300);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const on = () => setScroll(Math.min(1, window.scrollY / 700));
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const on = (n: number) => s >= n;
  const fade = (n: number) => `transition-all duration-700 ${on(n) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`;

  return (
    <div
      ref={ref}
      className="relative mx-auto h-[520px] w-full max-w-[560px] [perspective:1400px]"
      style={{ transform: `translateY(${scroll * 120}px) scale(${1 - scroll * 0.15})`, opacity: 1 - scroll * 0.6 }}
    >
      {/* floating satellites */}
      <Float className="left-0 top-6" delay="0s" show={on(2)}><Receipt className="h-4 w-4 text-aurora" /> Receipt · Currys · £1,299</Float>
      <Float className="right-0 top-0" delay="1s" show={on(3)}><ShieldCheck className="h-4 w-4 text-aurora" /> 2 Year Warranty</Float>
      <Float className="-left-4 bottom-28" delay="2s" show={on(1)}><Barcode className="h-4 w-4 text-aurora" /> SN QE65Q80C-4471</Float>
      <Float className="-right-2 bottom-36" delay="0.5s" show={on(5)}><Umbrella className="h-4 w-4 text-aurora" /> Insurance evidence ready</Float>
      <Float className="right-10 top-40" delay="1.5s" show={on(6)}><Wrench className="h-4 w-4 text-aurora" /> Wall mount checked</Float>

      {/* passport */}
      <div className="absolute left-1/2 top-1/2 w-[340px] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]">
        <div className="animate-float rounded-3xl border border-midnight-foreground/15 bg-midnight/85 p-4 text-midnight-foreground shadow-glow backdrop-blur-xl [transform:rotateX(8deg)_rotateY(-10deg)]">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-midnight-foreground/60">
            <span>Digital Passport</span><span className="text-aurora">MK-0042</span>
          </div>
          <div className="mt-3 aspect-[16/9] overflow-hidden rounded-2xl bg-midnight-foreground/5">
            <img src={tv} alt="Samsung TV in a living room" width={1024} height={768} className={`h-full w-full object-cover transition-all duration-1000 ${on(1) ? "scale-100 opacity-100" : "scale-110 opacity-0"}`} />
          </div>
          <h3 className={`mt-3 font-display text-xl ${fade(1)}`}>Samsung QLED 65”</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Row k="Value" v="£1,299" show={on(2)} />
            <Row k="Purchased" v="12 Mar 2026" show={on(2)} hi={s === 3} />
            <Row k="Warranty" v="2 years" show={on(3)} />
            <Row k="Expires" v="12 Mar 2028" show={on(4)} hi={s === 4} />
            <Row k="Location" v="Living Room" show={on(1)} icon />
            <Row k="Evidence" v="96%" show={on(5)} />
          </dl>
          <div className={`mt-3 h-1.5 overflow-hidden rounded-full bg-midnight-foreground/10 ${fade(5)}`}>
            <div className="h-full rounded-full bg-aurora transition-all duration-1000" style={{ width: on(5) ? "96%" : "0%" }} />
          </div>
          <div className={`mt-3 flex items-center gap-2 rounded-xl bg-aurora/15 px-3 py-2 text-xs ${fade(5)}`}>
            <ShieldCheck className="h-4 w-4 text-aurora" /> Warranty Agent active
          </div>
        </div>
      </div>

      {/* reminder + sera */}
      <div className={`absolute bottom-6 left-2 flex items-center gap-2 rounded-2xl border border-midnight-foreground/15 bg-midnight/90 px-4 py-3 text-sm text-midnight-foreground shadow-glow backdrop-blur ${fade(6)}`}>
        <Bell className="h-4 w-4 text-aurora" /> Warranty expires in 30 days
      </div>
      <div className={`absolute bottom-0 right-2 flex items-center gap-2 rounded-full bg-aurora px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow ${fade(7)}`}>
        <Sparkles className="h-4 w-4" /> Sera: “I’m watching this for you.”
      </div>
    </div>
  );
}

function Row({ k, v, show, hi, icon }: { k: string; v: string; show: boolean; hi?: boolean; icon?: boolean }) {
  return (
    <div className={`transition-all duration-700 ${show ? "opacity-100" : "opacity-0"}`}>
      <dt className="text-midnight-foreground/50">{k}</dt>
      <dd className={`flex items-center gap-1 font-medium transition-colors ${hi ? "text-aurora" : ""}`}>{icon && <MapPin className="h-3 w-3" />}{v}</dd>
    </div>
  );
}

function Float({ children, className, delay, show }: { children: React.ReactNode; className: string; delay: string; show: boolean }) {
  return (
    <div className={`absolute z-10 transition-all duration-700 ${className} ${show ? "opacity-100" : "opacity-0 -translate-y-4"}`}>
      <div className="animate-float flex items-center gap-2 whitespace-nowrap rounded-xl border border-midnight-foreground/15 bg-midnight/80 px-3 py-2 text-xs text-midnight-foreground backdrop-blur" style={{ animationDelay: delay }}>
        {children}
      </div>
    </div>
  );
}

/** Subtle connected matrix nodes background. */
export function MatrixNodes() {
  const pts = Array.from({ length: 28 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 61) % 100 }));
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
      {pts.map((p, i) => {
        const q = pts[(i + 3) % pts.length]!;
        return <line key={`l${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="currentColor" strokeWidth="0.05" className="text-aurora" />;
      })}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="0.35" className="animate-pulse fill-aurora" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />
      ))}
    </svg>
  );
}

export function Tick({ children }: { children: React.ReactNode }) {
  return <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-aurora" />{children}</li>;
}
