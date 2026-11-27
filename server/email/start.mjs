// Only stable diagnostic codes cross the runtime boundary. Error text can include a URI.
const causes = new Map([
  ["ERR_INVALID_URL", 41], ["Mail database environment mismatch", 42],
  ["Missing SMTP configuration", 43], ["Invalid mail submission port", 44],
  ["Staging mail requires one QA recipient", 45],
  ["28P01", 46], ["28000", 47], ["42501", 48], ["42P01", 49],
  ["SELF_SIGNED_CERT_IN_CHAIN", 50], ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", 51],
  ["ENOTFOUND", 52], ["ECONNREFUSED", 53], ["ETIMEDOUT", 54],
  ["Email submission did not complete", 55], ["ERR_MODULE_NOT_FOUND", 56],
  ["XX000", 57], ["Invalid recipient", 58], ["ERR_TLS_CERT_ALTNAME_INVALID", 59],
]);
try {
  await import("./drain.mjs");
} catch (error) {
  const code = causes.get(error.code) ?? causes.get(error.message) ?? 60;
  console.error("Mail worker failure", code);
  process.exitCode = code;
}
