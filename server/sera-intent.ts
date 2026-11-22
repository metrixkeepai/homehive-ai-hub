const sections: [RegExp, string][] = [
  [/\bassets?\b/, "assets"],
  [/\bwarrant(?:y|ies)\b/, "warranties"],
  [/\brenewals?\b/, "renewals"],
  [/\binsurance\b/, "insurance"],
  [/\bmaintenance\b/, "maintenance"],
  [/\bdocuments?\b/, "documents"],
  [/\bvehicles?\b/, "vehicles"],
  [/\bservices?\b/, "services"],
  [/\brooms?\b/, "rooms"],
  [/\btasks?\b/, "tasks"],
];
const noise = new Set(
  "a an the my in do i we me are is how many number of count list all show tell everything about where find which what when was were with for from did have on has at and or to by saved stored records record recently add added purchased bought came imported coming up soon due expire expires expiring next this month week belong belongs related information give that please know most property properties currently any total sum combined value spend spent cost policies upcoming renew information missing warranty purchased purchase bought our does it its".split(
    " ",
  ),
);
export function seraIntent(input: string) {
  const q = input.toLowerCase().replace(/google drive/g, "googledrive");
  let section = sections.find(([regex]) => regex.test(q))?.[1] ?? null;
  const source = /\b(gmail|googledrive|outlook|onedrive|email)\b/.exec(q)?.[1] ?? null;
  const mode = /missing.*warranty|without.*warranty/.test(q)
    ? "missing_warranty"
    : /sum|total (?:value|price|cost)|how much .*spen[td]/.test(q)
      ? "sum"
      : /\b(most|group by)\b/.test(q) && /propert/.test(q)
        ? "group"
        : /how many|number of|\bcount\b/.test(q)
          ? "count"
          : /expir|due|upcoming|coming up|renew next/.test(q)
            ? "due"
            : /add(ed)? this week|recently added/.test(q)
              ? "recent"
              : /related|receipt|belongs? to|everything about|know about/.test(q)
                ? "related"
                : /\blist\b|\bshow\b|what .* (do i have|are stored)|\bcame from\b/.test(q) || source
                  ? "list"
                  : "search";
  if (mode === "missing_warranty") section = "assets";
  const words = (q.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(
      (w) =>
        !noise.has(w) && w !== source && !sections.some(([re]) => re.test(w)) && w !== "receipt",
    )
    .map(
      (w) =>
        ({
          refrigerators: "fridge",
          refrigerator: "fridge",
          fridges: "fridge",
          contracts: "contract",
        })[w] ?? w,
    );
  return {
    mode,
    section,
    source: source === "googledrive" ? "Google Drive" : source,
    words: [...new Set(words)].slice(0, 8),
    window: q.includes("next month")
      ? "next_month"
      : q.includes("this month")
        ? "this_month"
        : "soon",
  };
}
