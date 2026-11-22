import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { toJSONAsync, fromCrossJSON } from "seroval";
export async function fixtureQA({ db, auth, base, session, user, property, check }) {
  const folder = ".output/server";
  const manifest = readFileSync(
    folder + "/" + readdirSync(folder).find((n) => n.includes("server-fn-resolver")),
    "utf8",
  );
  const post = async (fn, data) => {
    const id = manifest.match(
      new RegExp('"([a-f0-9]{64})": \\{\\s*functionName: "' + fn + '_createServerFn_handler"'),
    )?.[1];
    if (!id) throw Error("Candidate function unavailable");
    const r = await fetch(base + "/_serverFn/" + id, {
      method: "POST",
      headers: {
        origin: base,
        authorization: "Bearer " + session.access_token,
        "x-tsr-serverfn": "true",
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(await toJSONAsync({ data })),
      signal: AbortSignal.timeout(100000),
    });
    if (!r.ok) throw Error("Candidate returned HTTP " + r.status);
    const reply = fromCrossJSON(await r.json(), { refs: new Map() });
    if (reply?.error || reply?.result?.error) throw Error("Candidate rejected request");
    return reply?.result ?? reply;
  };
  await check("authenticated count RPC costs zero model calls", async () => {
    const start = new Date().toISOString();
    const out = await post("askSera", {
      workspaceId: null,
      messages: [{ role: "user", content: "How many records are in assets?" }],
    });
    if (!/\b3 matching assets\b/.test(out.reply) || out.refs.length !== 3)
      throw Error("Incorrect asset count");
    const r = await db
      .from("ai_usage_log")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id)
      .eq("feature", "sera")
      .gte("created_at", start);
    if (r.error || r.count !== 0) throw Error("Unexpected provider call");
  });
  await check("synthetic invoice extraction and exact result reuse", async () => {
    const input = {
      mode: "Import email",
      workspaceId: null,
      text: "Subject: Currys purchase receipt. Invoice QA-2026-007. One Bosch kettle bought on 20 November 2026 for GBP 65.00 at Currys. Warranty: two years.",
    };
    const start = new Date().toISOString();
    const first = await post("extractRecords", input);
    if (!first.records?.some((r) => r.section === "assets" && /bosch/i.test(JSON.stringify(r))))
      throw Error("Fixture asset missing");
    const paid = await db
      .from("ai_usage_log")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id)
      .eq("feature", "capture")
      .gte("created_at", start);
    if (paid.error || !paid.count) throw Error("Initial extraction usage missing");
    const second = await post("extractRecords", input);
    if (JSON.stringify(first.records) !== JSON.stringify(second.records))
      throw Error("Repeat extraction changed");
    const usage = await db
      .from("ai_usage_log")
      .select("cost_usd,ok")
      .eq("user_id", user.id)
      .eq("feature", "capture")
      .gte("created_at", start);
    if (
      usage.error ||
      !usage.data?.length ||
      usage.data.length !== paid.count ||
      usage.data.some((r) => !r.ok)
    )
      throw Error("Provider telemetry unavailable");
    return {
      calls: usage.data.length,
      cost_usd: usage.data.reduce((n, r) => n + Number(r.cost_usd), 0),
    };
  });
  await check("synthetic reviewed attachment opens with owner storage permission", async () => {
    const b = Buffer.from(
        "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCAzMzAgMjAwIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMDAwMTAxMDAwMDAwKzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMDAwMTAxMDAwMDAwKzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxMzQKPj4Kc3RyZWFtCkdhcFFoMEU9RiwwVVxIM1RccE5ZVF5RS2s/dGM+SVAsO1cjVTFeMjNpaFBFTV8/Q1c0S0lTaFwmdUdqPytoN3B1Slc6KiFNKydqaUdwU15fXGRENC5gUTh1KWZyNjhEM041OF04VTgkOkFTUFtPWikwaVlROXBCQ2E7Pig1ITNuM3QpWn4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDA5MiAwMDAwMCBuIAowMDAwMDAwMTk5IDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKMDAwMDAwMDQ2MCAwMDAwMCBuIAowMDAwMDAwNzIxIDAwMDAwIG4gCjAwMDAwMDA3ODAgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8MWMxNzgxOThmYmRmYTUxYjI1OTk1ZDg5ZDQxMDIwNDM+PDFjMTc4MTk4ZmJkZmE1MWIyNTk5NWQ4OWQ0MTAyMDQzPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA1IDAgUgovUm9vdCA0IDAgUgovU2l6ZSA4Cj4+CnN0YXJ0eHJlZgoxMDA0CiUlRU9GCg==",
        "base64",
      ),
      hash = createHash("sha256").update(b).digest("hex");
    const records = [
      {
        section: "documents",
        title: "Synthetic warranty PDF",
        subtitle: "Storage fixture",
        relates_to: "",
        fields: [],
      },
    ];
    const d = await db
      .from("connector_reviews")
      .insert({
        user_id: user.id,
        provider: "google_mail",
        external_key: randomUUID(),
        title: "Synthetic attachment",
        proposals: records,
        source: [
          ["Source", "Gmail"],
          ["Sender", "Synthetic QA"],
        ],
        attachment: { name: "warranty-fixture.pdf", mime: "application/pdf", hash, size: b.length },
      })
      .select("id")
      .single();
    if (d.error) throw Error("Fixture unavailable");
    const confirmed = await db.rpc("confirm_connector_review", {
      _id: d.data.id,
      _user: user.id,
      _workspace: null,
      _property: property,
      _room: "Utility room",
      _records: records,
      _path: null,
    });
    if (confirmed.error) throw Error("Confirmation failed");
    const path = user.id + "/" + confirmed.data[0].id + "/" + hash;
    const up = await auth.storage
      .from("evidence")
      .upload(path, b, { contentType: "application/pdf" });
    if (up.error) throw Error("Owner upload failed: " + up.error.statusCode);
    const attached = await db.rpc("complete_connector_evidence", {
      _id: d.data.id,
      _user: user.id,
      _workspace: null,
      _path: path,
    });
    if (attached.error) throw Error("Attachment metadata failed");
    const downloaded = await auth.storage.from("evidence").download(path);
    if (
      downloaded.error ||
      createHash("sha256")
        .update(Buffer.from(await downloaded.data.arrayBuffer()))
        .digest("hex") !== hash
    )
      throw Error("Evidence download mismatch");
    const ref = await auth
      .from("evidence_files")
      .select("connector_source,name")
      .eq("item_id", confirmed.data[0].id)
      .single();
    if (ref.error || ref.data.connector_source !== "Gmail")
      throw Error("Missing evidence provenance");
  });
}
