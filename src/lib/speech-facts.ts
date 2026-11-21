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
export function translationRisk(original: string, english: string, language: string) {
  let locale = "en";
  try {
    locale = Intl.getCanonicalLocales(language)[0] || "en";
  } catch {
    /* mixed or unknown */
  }
  const numbers = numericEntities(original, locale);
  if (JSON.stringify(numbers) !== JSON.stringify(numericEntities(english))) return "numbers";
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
  if (symbols(original) && symbols(original) !== symbols(english)) return "units";
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
