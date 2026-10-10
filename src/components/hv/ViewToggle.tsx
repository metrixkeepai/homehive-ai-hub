import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "grid" | "table";

/** Remembers the grid/table choice per module in this browser. */
export function useViewMode(key: string): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("grid");
  useEffect(() => {
    const saved = window.localStorage.getItem(`mk-view-${key}`);
    setMode(saved === "table" ? "table" : "grid");
  }, [key]);
  const set = (v: ViewMode) => { setMode(v); window.localStorage.setItem(`mk-view-${key}`, v); };
  return [mode, set];
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (v: ViewMode, label: string, Icon: typeof List) => (
    <button type="button" title={label} aria-label={label} aria-pressed={mode === v} onClick={() => onChange(v)}
      className={`grid h-8 w-8 place-items-center rounded-full transition ${mode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
  return <div className="flex shrink-0 items-center gap-1 rounded-full border bg-card p-1 shadow-soft">{btn("grid", "Grid view", LayoutGrid)}{btn("table", "Table view", List)}</div>;
}
