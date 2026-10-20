/** Pure feature-switch rule shared by server and tests. */
export function flagOn(
  f: { enabled: boolean; audiences: string[]; rollout: number },
  audience: string,
  userId: string,
) {
  if (!f.enabled) return false;
  if (f.audiences.length && !f.audiences.includes(audience)) return false;
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 100 < f.rollout;
}
