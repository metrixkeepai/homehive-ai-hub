import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Item } from "./data";
import { useStore } from "./store";
import { PropertySelect, useDefaultProperty } from "./Properties";

const inputClass =
  "mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring";

/** Create/edit modal for inventory records with optional property link. */
export function RecordEditor({
  section,
  item,
  addFields,
  title: heading,
  onClose,
}: {
  section: string;
  item?: Item;
  addFields?: string[];
  title?: string;
  onClose: () => void;
}) {
  const { add, update } = useStore();
  const defaultProperty = useDefaultProperty();
  const fieldKeys =
    addFields?.length ? addFields : (item?.fields.map(([k]) => k) ?? []).filter(Boolean);
  const titleFromFields = Boolean(addFields?.length);
  const [name, setName] = useState(item?.title ?? "");
  const [propertyId, setPropertyId] = useState<string | null>(
    item?.propertyId ?? defaultProperty,
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const fromItem = Object.fromEntries(item?.fields ?? []);
    const init = Object.fromEntries(fieldKeys.map((k) => [k, fromItem[k] ?? ""]));
    if (titleFromFields && addFields?.[0] && item?.title) init[addFields[0]] = item.title;
    return init;
  });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = (
      titleFromFields && addFields?.[0] ? values[addFields[0]] ?? "" : name
    ).trim();
    if (!title) {
      toast.error(
        titleFromFields && addFields?.[0]
          ? `Please enter ${addFields[0].toLowerCase()}`
          : "Please enter a name",
      );
      return;
    }
    const fields: [string, string][] = fieldKeys.length
      ? fieldKeys.map((k) => [
          k,
          titleFromFields && k === addFields?.[0] ? title : (values[k] ?? "").trim() || "—",
        ])
      : (item?.fields ?? []);
    // Keep any fields not shown in the form (e.g. Captured via).
    const shown = new Set(fieldKeys.map((k) => k.toLowerCase()));
    const extras = (item?.fields ?? []).filter(([k]) => !shown.has(k.toLowerCase()));
    const record: Item = {
      id: item?.id ?? "",
      title,
      subtitle:
        fields
          .slice(1)
          .map(([, v]) => v)
          .filter((v) => v && v !== "—")
          .join(" · ") ||
        item?.subtitle ||
        "Saved",
      status: item?.status ?? ["Saved", "primary"],
      fields: [...fields, ...extras],
      actions: item?.actions ?? ["Edit"],
      propertyId,
    };
    setBusy(true);
    const ok = item
      ? await update(item.id, record)
      : await add(section, { ...record, id: "" });
    setBusy(false);
    if (!ok) {
      toast.error("Couldn't save — please try again");
      return;
    }
    toast.success(item ? `${title} updated` : `${title} saved to your MatrixKeep`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        className="animate-rise max-h-[min(90vh,44rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-card p-7 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">
            {heading ?? (item ? "Edit record" : "Add record")}
          </h3>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {!titleFromFields && (
          <label className="block text-sm font-medium">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              className={inputClass}
              autoFocus
            />
          </label>
        )}
        <label className="block text-sm font-medium">
          Property / location
          <PropertySelect
            value={propertyId}
            onChange={setPropertyId}
            className={inputClass}
          />
        </label>
        {fieldKeys.map((f, i) => (
          <label key={f} className="block text-sm font-medium">
            {f}
            <input
              value={values[f] ?? ""}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              className={inputClass}
              autoFocus={titleFromFields && i === 0}
              maxLength={f === addFields?.[0] ? 200 : undefined}
            />
          </label>
        ))}
        <button
          disabled={busy}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : item ? "Save changes" : "Save"}
        </button>
      </form>
    </div>
  );
}
