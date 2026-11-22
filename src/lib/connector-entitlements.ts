export function connectorAllowed(data: Record<string, { on?: boolean }> | null, connector: string) {
  const keys: Record<string, string[]> = {
    google_mail: ["gmail", "email_integration"],
    outlook: ["outlook", "gmail", "email_integration"],
    google_calendar: ["google_calendar", "calendar_integration"],
    google_drive: ["google_drive", "bulk_imports"],
    onedrive: ["onedrive", "google_drive", "bulk_imports"],
  };
  for (const key of keys[connector] ?? []) {
    if (data && Object.hasOwn(data, key)) return data[key]?.on === true;
  }
  return false;
}
