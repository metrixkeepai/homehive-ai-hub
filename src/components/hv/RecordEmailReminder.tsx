import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Item } from "./data";
import { field } from "./tracking";

const dateFields: Record<string, string> = {
  warranties: "Expiry date",
  documents: "Expiry date",
  insurance: "Renewal date",
  maintenance: "Due date",
};

export function RecordEmailReminder({ item, section }: { item: Item; section: string }) {
  const client = useQueryClient();
  const key = ["record-email-reminder", item.id];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("record_email_reminder", { _record: item.id });
      if (error) throw error;
      return data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await supabase.rpc("record_email_reminder", {
        _record: item.id,
        _enabled: enabled,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (value) => client.setQueryData(key, value),
    onError: () => toast.error("Couldn’t update your email reminder."),
  });
  const date = field(item, dateFields[section] ?? "");
  if (typeof query.data !== "boolean" || (!query.data && !/^\d{4}-\d{2}-\d{2}$/.test(date)))
    return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={query.data}
        disabled={mutation.isPending}
        onChange={(event) => mutation.mutate(event.target.checked)}
      />
      Email me when due within 7 days
    </label>
  );
}
