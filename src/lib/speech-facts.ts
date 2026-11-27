// Compare complete entities. Decimal and grouping separators follow the source locale.
function decimalDigits(text: string) {
  return text.normalize("NFKC").replace(/\p{Nd}/gu, (digit) => {
    const cp = digit.codePointAt(0)!;
    let start = cp;
    while (start > 0 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
    return String((cp - start) % 10);
  });
}
function canonical(text: string, locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find((p) => p.type === "group")?.value;
  const decimal = parts.find((p) => p.type === "decimal")?.value;
  let value = decimalDigits(text)
    .replace(/\u066b/g, ".")
    .replace(/\u066c/g, "");
  if (group && !/\s/.test(group)) {
    const grouping = group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp("(?<=\\d)" + grouping + "(?=\\d{3}(?:\\D|$))", "g"), "");
  } else value = value.replace(/(?<=\d)[\s\u202f](?=\d{3}(?:\D|$))/gu, "");
  if (decimal && decimal !== ".") value = value.replaceAll(decimal, ".");
  return value;
}
export function numericEntities(text: string, locale = "en-GB") {
  const value = canonical(text, locale);
  return Array.from(value.matchAll(/[-−]?\d+(?:\.\d+)?/g), (m) =>
    m[0]
      .replace("−", "-")
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, ""),
  ).sort();
}
export function hasExactGbp(text: string, amount: number) {
  const value = canonical(text, "en-GB");
  const money =
    /(?:£|\bGBP\s*)\s*(-?\d+(?:\.\d+)?)|(?<![\w.,-])(-?\d+(?:\.\d+)?)\s*(?:British\s+pounds?|pounds?(?:\s+sterling)?|GBP)\b/giu;
  const values = Array.from(value.matchAll(money), (m) => Number(m[1] ?? m[2]));
  return values.length > 0 && values.every((v) => v === amount);
}
function calendarTerms(text: string, locale: string) {
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  const tokens = (v: string) =>
    [...segmenter.segment(v.normalize("NFKC").toLocaleLowerCase(locale))]
      .filter((x) => x.isWordLike)
      .map((x) => x.segment)
      .join(" ");
  const source = " " + tokens(text) + " ";
  const terms: string[] = [];
  const add = (name: string, label: string) => {
    const phrase = tokens(name);
    if (phrase && source.includes(" " + phrase + " ")) terms.push(label);
  };
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const offset of [-1, 0, 1]) add(relative.format(offset, "day"), "day:" + offset);
  const month = new Intl.DateTimeFormat(locale, {
    month: "long",
    calendar: "gregory",
    timeZone: "UTC",
  });
  for (let m = 0; m < 12; m++) add(month.format(Date.UTC(2024, m, 15)), "month:" + m);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  for (let d = 0; d < 7; d++) add(weekday.format(Date.UTC(2024, 0, 7 + d)), "weekday:" + d);
  return terms;
}
export function translationRisk(original: string, english: string, language: string) {
  let locale = "en";
  try {
    locale = Intl.getCanonicalLocales(language)[0] || "en";
  } catch {
    /* mixed or unknown */
  }
  const numbers = numericEntities(original, locale);
  if (JSON.stringify(numbers) !== JSON.stringify(numericEntities(english))) return "numbers";
  const dates = calendarTerms(original, locale);
  const translatedDates = calendarTerms(english, "en-GB");
  if (dates.some((t) => !translatedDates.includes(t))) return "date";
  const sourceAmounts = moneyEntities(canonical(original, locale));
  const targetAmounts = moneyEntities(english);
  if (
    sourceAmounts.length &&
    JSON.stringify(sourceAmounts.sort()) !== JSON.stringify(targetAmounts.sort())
  )
    return "currency";
  const codes =
    original.match(/\b(?=[A-Za-z\d-]*\d)(?=[A-Za-z\d-]*[A-Za-z])[A-Za-z\d]+(?:-[A-Za-z\d]+)*\b/g) ??
    [];
  const tokens = new Set(english.toLowerCase().match(/[a-z\d]+(?:-[a-z\d]+)*/g));
  if (codes.some((code) => !tokens.has(code.toLowerCase()))) return "identifier";
  const symbols = (s: string) =>
    [...s.matchAll(/[£€$¥₹%]/gu)]
      .map((m) => m[0])
      .sort()
      .join("");
  // Currency names and symbols can legitimately change across scripts (₹65 → 65 rupees).
  const sourceSymbols = sourceAmounts.length
    ? symbols(original).replace(/[£€$¥₹]/gu, "")
    : symbols(original);
  const translatedSymbols = sourceAmounts.length
    ? symbols(english).replace(/[£€$¥₹]/gu, "")
    : symbols(english);
  if (sourceSymbols && sourceSymbols !== translatedSymbols) return "units";
  return null;
}

// Reviewed English text and extracted monetary fields use British numeric conventions.
export function moneyEntities(input: string) {
  const currency =
    "(?:GBP|EUR|USD|INR|AED|CAD|AUD|JPY|CNY|£|€|\\$|₹|¥|pounds?(?: sterling)?|euros?|dollars?|rupees?)";
  const number = "(-?\\d+(?:\\.\\d+)?)";
  const pattern = new RegExp(
    "(" +
      currency +
      ")\\s*" +
      number +
      "(?!\\d|\\.\\d)|(?<![\\w.,-])" +
      number +
      "\\s*(" +
      currency +
      ")(?!\\p{L})",
    "giu",
  );
  const aliases: Record<string, string> = {
    "£": "GBP",
    POUND: "GBP",
    POUNDS: "GBP",
    "POUNDS STERLING": "GBP",
    "POUND STERLING": "GBP",
    "€": "EUR",
    EURO: "EUR",
    EUROS: "EUR",
    "₹": "INR",
    RUPEE: "INR",
    RUPEES: "INR",
    DOLLARS: "$",
    DOLLAR: "$",
  };
  return Array.from(canonical(input, "en-GB").matchAll(pattern), (m) => {
    const c = (m[1] ?? m[4]!).toUpperCase();
    return (aliases[c] ?? c) + " " + Number(m[2] ?? m[3]);
  });
}
