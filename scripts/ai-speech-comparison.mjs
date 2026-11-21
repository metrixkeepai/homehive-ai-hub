import { readFileSync } from "node:fs";
import { join } from "node:path";
function words(s, language) {
  return [
    ...new Intl.Segmenter(language, { granularity: "word" }).segment(
      s.normalize("NFKC").toLowerCase(),
    ),
  ]
    .filter((x) => x.isWordLike)
    .map((x) => x.segment);
}
export function wordErrors(reference, answer, language) {
  const a = words(reference, language),
    b = words(answer, language);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return { word_errors: prev[b.length], reference_words: a.length };
}
export async function compareMini({ spec, dir, db, userId, full, normalize, record }) {
  const bytes = readFileSync(join(dir, spec.audio)),
    seconds = (bytes.length - 44) / 32000;
  const hold = await db.rpc("reserve_ai_operation", {
    _user: userId,
    _workspace: null,
    _feature: "speech",
    _units: 1,
    _estimate: 0.003 + (seconds / 60) * 0.0045,
  });
  if (hold.error) throw Error("Comparison reservation unavailable");
  const form = new FormData();
  form.append("model", "gpt-4o-mini-transcribe");
  form.append(
    "prompt",
    "Transcribe exactly in the spoken language, including purchase dates, amounts and units.",
  );
  form.append("file", new Blob([bytes], { type: "audio/wav" }), "benchmark.wav");
  const start = Date.now(),
    r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
  if (!r.ok) {
    await record(
      JSON.stringify({ label: "speech-comparison", kind: spec.kind, mini_http: r.status }),
    );
    return;
  }
  const result = await r.json();
  const usage = result.usage ?? {},
    audio = usage.input_token_details?.audio_tokens ?? usage.input_tokens_details?.audio_tokens,
    text = usage.input_token_details?.text_tokens ?? usage.input_tokens_details?.text_tokens;
  // Published mini pricing is token-based; the per-minute figure is only an estimate.
  const exact =
    Number.isFinite(audio) && Number.isFinite(text) && Number.isFinite(usage.output_tokens);
  const { data: rates, error: rateError } = await db
    .from("ai_model_rates")
    .select("input_per_million_usd,output_per_million_usd")
    .eq("model", "gpt-4o-mini-transcribe")
    .single();
  if (rateError) throw Error("Missing benchmark speech rate");
  const usd = exact
    ? ((audio + text) * rates.input_per_million_usd +
        usage.output_tokens * rates.output_per_million_usd) /
      1e6
    : (seconds / 60) * 0.003;
  const recorded = await db.from("ai_usage_log").insert({
    user_id: userId,
    feature: "benchmark-mini-transcribe",
    model: "gpt-4o-mini-transcribe",
    reservation_id: hold.data,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    audio_seconds: seconds,
    cost_usd: usd,
    ok: true,
    latency_ms: Date.now() - start,
    usage_details: { price_basis: exact ? "modality_tokens" : "duration_estimate" },
  });
  if (recorded.error) throw Error("Speech comparison accounting failed");
  if (exact) await db.rpc("settle_ai_operation", { _id: hold.data, _user: userId, _calls: 1 });
  await record(
    JSON.stringify({
      label: "speech-comparison",
      kind: spec.kind,
      seconds,
      mini_usd: usd,
      price_basis: exact ? "token" : "duration_estimate",
      full: wordErrors(spec.script, full, spec.language),
      downstream: await normalize(result.text),
      mini: wordErrors(spec.script, result.text, spec.language),
    }),
  );
}
