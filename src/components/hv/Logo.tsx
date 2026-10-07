import { Link } from "@tanstack/react-router";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-aurora shadow-glow">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-primary-foreground" strokeWidth={2.2}>
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </svg>
      </span>
      <span className={`font-display text-lg font-semibold tracking-tight ${light ? "text-midnight-foreground" : "text-foreground"}`}>
        Matrix<span className="text-aurora">Keep</span>
      </span>
    </Link>
  );
}
