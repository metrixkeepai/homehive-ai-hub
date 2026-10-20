import type { Json } from "@/integrations/supabase/types";
export function jsonObject(value: Json | undefined): { [key: string]: Json | undefined } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function jsonString(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}
