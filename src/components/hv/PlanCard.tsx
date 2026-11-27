import { useState, type ReactNode } from "react";
import {
  Check,
  Lock,
  Users,
  MapPin,
  Package,
  HardDrive,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { type PlanDef, priceLabel, gbp, yearlySaving } from "@/lib/plans";
import { catalogueFor, effective, formatLimit, groupsFor } from "@/lib/entitlements";

export function BillingToggle({
  yearly,
  onChange,
}: {
  yearly: boolean;
  onChange: (y: boolean) => void;
}) {
  return (
    <div className="mx-auto flex w-fit gap-1 rounded-full border bg-card p-1 text-sm">
      {[false, true].map((y) => (
        <button
          key={String(y)}
          onClick={() => onChange(y)}
          className={`rounded-full px-4 py-2 font-semibold transition ${yearly === y ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
        >
          {y ? "Yearly · save ~17%" : "Monthly"}
        </button>
      ))}
    </div>
  );
}

export function PlanCard({
  p,
  yearly,
  highlight,
  current,
  cta,
}: {
  p: PlanDef;
  yearly: boolean;
  highlight?: boolean;
  current?: boolean;
  cta: ReactNode;
}) {
  const [more, setMore] = useState(false);
  const dark = highlight && !current;
  const sub = dark ? "text-midnight-foreground/70" : "text-muted-foreground";
  const save = yearlySaving(p);
  const strip: [typeof Users, string][] = [
    [Users, p.cap.users],
    [MapPin, p.cap.places],
    [Package, p.cap.assets],
    [HardDrive, p.cap.storage],
    [Sparkles, p.cap.captures],
  ];
  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl border p-6 transition hover:-translate-y-1 ${current ? "border-primary bg-card ring-2 ring-primary/30" : dark ? "bg-midnight text-midnight-foreground shadow-glow" : "bg-card shadow-soft"}`}
    >
      {(p.badge || current) && (
        <span className="absolute -top-3 left-6 rounded-full bg-aurora px-3 py-1 text-xs font-semibold text-primary-foreground">
          {current ? "Your plan" : p.badge}
        </span>
      )}
      <h3 className="font-semibold">{p.name}</h3>
      <p className={`mt-1 text-sm ${sub}`}>{p.positioning}</p>
      <p className="mt-5 font-display text-4xl">
        {priceLabel(p, yearly)}
        {(yearly ? p.yearly : p.monthly) ? (
          <span className="text-sm opacity-60">{yearly ? "/year" : "/month"}</span>
        ) : null}
      </p>
      <p className={`mt-1 h-4 text-xs ${sub}`}>
        {p.monthly && p.yearly
          ? yearly
            ? `${gbp(Math.round((p.yearly! / 12) * 100) / 100)}/month · save ${gbp(save)}`
            : `or ${gbp(p.yearly!)}/year`
          : p.monthly === 0
            ? "Free forever"
            : "Tailored contract"}
      </p>
      <div
        className={`mt-5 grid grid-cols-2 gap-2 rounded-2xl p-3 text-xs ${dark ? "bg-midnight-foreground/10" : "bg-secondary/60"}`}
      >
        {strip.map(([I, t]) => (
          <span key={t} className="flex min-w-0 items-center gap-1.5">
            <I className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{t}</span>
          </span>
        ))}
      </div>
      <p className={`mt-4 text-xs ${sub}`}>
        <span className="font-semibold">Best for:</span> {p.bestFor}
      </p>
      <p className="mt-2 text-sm font-medium">{p.outcome}</p>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm">
        {(more ? p.benefits : p.benefits.slice(0, 5)).map((x) => (
          <li key={x} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {x}
          </li>
        ))}
        {more && (
          <li className="flex gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {p.cap.captures} · {p.cap.sera}
          </li>
        )}
        {more && p.agents.length > 0 && (
          <li className="flex gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            AI agents: {p.agents.join(", ")}
          </li>
        )}
        {more && (
          <li className={`flex gap-2 ${sub}`}>
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            {p.support}
          </li>
        )}
        {more &&
          p.locked?.map((x) => (
            <li key={x} className={`flex gap-2 ${sub}`}>
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              {x} — on paid plans
            </li>
          ))}
      </ul>
      <button
        onClick={() => setMore(!more)}
        className={`mt-3 flex items-center gap-1 text-xs font-semibold ${sub}`}
      >
        {more ? "Show less" : "See everything included"}
        <ChevronDown className={`h-3.5 w-3.5 transition ${more ? "rotate-180" : ""}`} />
      </button>
      <div className="mt-5 space-y-2">{cta}</div>
    </div>
  );
}

/** Side-by-side comparison driven by each plan's live feature settings (approved Super Admin versions over defaults). */
export function CompareTable({ list }: { list: PlanDef[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!list.length) return null;
  const aud = list[0]!.audience;
  const ents = Object.fromEntries(list.map((p) => [p.key, effective(p.key, p.entitlements)]));
  const feats = catalogueFor(aud);
  const cell = (k: string, f: string, limits: boolean) => {
    const e = ents[k]?.[f];
    return limits ? (
      formatLimit(e)
    ) : e?.on ? (
      <Check className="h-4 w-4 text-primary" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  };
  return (
    <div className="overflow-x-auto rounded-3xl border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-4 text-left font-semibold">Compare plans</th>
            {list.map((p) => (
              <th key={p.key} className="p-4 text-left font-semibold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        {groupsFor(aud).map((g) => {
          const fs = feats.filter((f) => f.group === g);
          const cap = g === "Capacity";
          const shown = cap || open === g;
          return (
            <tbody key={g}>
              <tr className="border-b bg-secondary/40">
                <td colSpan={list.length + 1} className="p-0">
                  <button
                    type="button"
                    onClick={() => !cap && setOpen(open === g ? null : g)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                  >
                    {g}
                    {!cap && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition ${shown ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                </td>
              </tr>
              {shown &&
                fs.map((f) => (
                  <tr key={f.key} className="border-b last:border-0">
                    <td className="p-4 text-muted-foreground">{f.name}</td>
                    {list.map((p) => (
                      <td key={p.key} className="p-4">
                        {cell(p.key, f.key, !!f.limits)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          );
        })}
        <tbody>
          <tr>
            <td className="p-4 text-muted-foreground">Support</td>
            {list.map((p) => (
              <td key={p.key} className="p-4">
                {p.support}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
