import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSection } from "./data";

type L = {
  id: string;
  section: string;
  title: string;
  label: string;
  via: string | null;
  at: string;
  outgoing: boolean;
};
const LABEL: Record<string, [string, string]> = {
  EXTRACTED_FROM: ["Extracted from this record", "Source document"],
  MAINTENANCE_FOR: ["Maintenance on this", "This work was on"],
  WARRANTY_FOR: ["Warranty for this", "Covers"],
  INSURANCE_FOR: ["Insurance for this", "Insures"],
  TASK_FOR: ["Task for this", "Task about"],
  SAME_SOURCE: ["Captured together", "Captured together"],
  RELATED_TO: ["Related", "Related"],
};

export function useRecordLinks(itemId: string) {
  const [links, setLinks] = useState<L[] | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase
        .from("record_links")
        .select("source_item_id,target_item_id,relationship_type,source_capture_type,created_at")
        .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);
      const rows = data ?? [];
      const ids = [
        ...new Set(
          rows.map((r) => (r.source_item_id === itemId ? r.target_item_id : r.source_item_id)),
        ),
      ];
      const { data: items } = ids.length
        ? await supabase.from("home_items").select("id,section,title").in("id", ids)
        : { data: [] };
      const byId = new Map((items ?? []).map((i) => [i.id, i]));
      const out = rows.flatMap((r) => {
        const outgoing = r.source_item_id === itemId;
        const other = byId.get(outgoing ? r.target_item_id : r.source_item_id);
        if (!other) return [];
        const lbl = LABEL[r.relationship_type] ?? LABEL["RELATED_TO"]!;
        return [
          {
            id: other.id,
            section: other.section,
            title: other.title,
            label: outgoing ? lbl[1] : lbl[0],
            via: r.source_capture_type,
            at: r.created_at,
            outgoing,
          },
        ];
      });
      if (!off) setLinks(out);
    })();
    return () => {
      off = true;
    };
  }, [itemId]);
  return links;
}

export function RelatedRecords({ links }: { links: L[] }) {
  const groups = new Map<string, L[]>();
  links.forEach((l) => groups.set(l.section, [...(groups.get(l.section) ?? []), l]));
  return (
    <div className="space-y-5">
      {[...groups].map(([sec, ls]) => {
        const s = getSection(sec);
        const Icon = s?.icon;
        return (
          <div key={sec}>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              {s?.title ?? sec} · {ls.length}
            </p>
            <div className="space-y-2">
              {ls.map((l) => (
                <Link
                  key={l.id + l.label}
                  to="/app/$section/$id"
                  params={{ section: l.section, id: l.id }}
                  className="flex items-center gap-3 rounded-2xl border p-4 transition hover:border-primary"
                >
                  {Icon && <Icon className="h-5 w-5 text-primary" />}
                  <div className="flex-1">
                    <p className="font-semibold">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.label}
                      {l.via ? ` · via ${l.via}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
