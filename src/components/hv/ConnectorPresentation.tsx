import { toneClass } from "./store";
export const connectorButton =
  "rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50";
export const when = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Never";
export function ConnectorBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass(tone)}`}>
        {label}
      </span>
    </div>
  );
}
export function ConnectorFields({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
          <dd className="mt-1 break-words font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
export type DriveFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  modifiedTime: string;
};
export function DriveBrowser({
  name,
  files,
  search,
  onSearch,
  onBrowse,
  onImport,
  busy,
}: {
  name: string;
  files: DriveFile[] | null;
  search: string;
  onSearch: (s: string) => void;
  onBrowse: () => void;
  onImport: (id: string) => void;
  busy: string | null;
}) {
  return (
    <div className="mt-6 space-y-3 border-t pt-6">
      <p className="font-semibold">Import from {name}</p>
      <div className="flex gap-2">
        <input
          aria-label={`Search ${name === "Google Drive" ? "Drive" : name} files`}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search file names (PDFs and photos)"
          className="min-w-0 flex-1 rounded-md border bg-card px-3 py-2 text-sm"
        />
        <button
          onClick={onBrowse}
          disabled={!!busy}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy === "browse" ? "Loading…" : files ? "Search" : "Choose files"}
        </button>
      </div>
      {files && files.length === 0 && (
        <p className="text-sm text-muted-foreground">No PDFs or photos found.</p>
      )}
      {files?.map((f) => (
        <div key={f.id} className="flex items-center gap-3 rounded-2xl border p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{f.name}</p>
            <p className="text-xs text-muted-foreground">
              {f.mimeType === "application/pdf" ? "PDF" : "Photo"} ·{" "}
              {(f.size / 1024 / 1024).toFixed(1)} MB ·{" "}
              {new Date(f.modifiedTime).toLocaleDateString("en-GB")}
            </p>
          </div>
          <button
            disabled={!!busy}
            onClick={() => onImport(f.id)}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy === f.id ? "Importing…" : "Import"}
          </button>
        </div>
      ))}
    </div>
  );
}
