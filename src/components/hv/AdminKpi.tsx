import { Link } from "@tanstack/react-router";

export function Kpi({ label, value, hint, to }: { label: string; value: string | number; hint?: string; to?: string }) {
  const body = (<><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</>);
  const cls = "block rounded-xl border bg-card p-4";
  return to ? <Link to={to} className={`${cls} transition hover:border-primary`}>{body}</Link> : <div className={cls}>{body}</div>;
}
