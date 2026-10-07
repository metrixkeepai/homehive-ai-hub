import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { Item, Tone } from "./data";

export const field = (item: Item, key: string) => item.fields.find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1] ?? "";
export function trackingDate(item: Item) {
  const value = field(item, "Expiry date") || field(item, "Renewal date");
  const parsed = parseISO(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parsed) ? parsed : null;
}
export function trackingStatus(item: Item, now = new Date()): { label: string; tone: Tone; bucket: string; days: number | null } {
  if (field(item, "Status") === "Archived") return { label: "Archived", tone: "muted", bucket: "archived", days: null };
  const date = trackingDate(item);
  if (!date) return { label: "Date needed", tone: "muted", bucket: "missing", days: null };
  const days = differenceInCalendarDays(date, now);
  if (days < 0) return { label: `${Math.abs(days)} days overdue`, tone: "danger", bucket: "overdue", days };
  if (days === 0) return { label: "Due today", tone: "warning", bucket: "soon", days };
  if (days <= 30) return { label: `${days} days left`, tone: "warning", bucket: "soon", days };
  return { label: "Active", tone: "success", bucket: "active", days };
}
export function downloadReminder(item: Item) {
  const date = trackingDate(item);
  if (!date) return false;
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const reminder = Number(field(item, "Remind me (days before)") || 30);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MatrixKeep//Reminders//EN", "BEGIN:VEVENT", `UID:${item.id}@matrixkeep`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${format(date, "yyyyMMdd")}`, `SUMMARY:${escape(item.title)} — due`, `DESCRIPTION:${escape(field(item, "Notes") || item.subtitle)}`, "BEGIN:VALARM", `TRIGGER:-P${Math.max(0, reminder)}D`, "ACTION:DISPLAY", `DESCRIPTION:${escape(item.title)} due soon`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"];
  const url = URL.createObjectURL(new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = "matrixkeep-reminder.ics"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}