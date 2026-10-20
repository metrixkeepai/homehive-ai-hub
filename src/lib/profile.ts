/** Only these ordinary profile fields may be sent by customer forms. Privileges are server-owned. */
export const editableProfileFields = [
  "display_name",
  "avatar_url",
  "household",
  "account_type",
  "org_name",
  "sector",
  "job_title",
  "phone",
  "language",
  "currency",
  "timezone",
  "country",
  "bio",
  "business_type",
  "org_size",
  "branches",
] as const;

export function editableProfilePatch(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    editableProfileFields
      .filter((key) => Object.hasOwn(input, key))
      .map((key) => [key, input[key]]),
  );
}
