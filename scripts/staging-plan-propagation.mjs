export async function checkPlanPropagation({ admin, page, db, base, key, userId, executionId }) {
  let phase = "READ_APPROVED";
  try {
    const approved = async () => {
      const { data, error } = await db
        .from("plan_versions")
        .select("id,version,entitlements")
        .eq("plan_key", key)
        .eq("status", "approved")
        .single();
      if (error || !data) throw Error("Approved plan unavailable");
      return data;
    };
    const before = await approved();
    phase = "OPEN_APPROVED";
    const limit = before.entitlements.ai_captures.limit;
    const note = "QA allowance " + executionId;
    const target = limit + 1;
    await admin.goto(base + "/super-admin/plans/" + key);
    await admin.getByRole("cell", { name: "v" + before.version, exact: true }).waitFor();
    const latest = admin.locator("tbody tr").first();
    if (
      (await latest.getByRole("cell", { name: /^draft$/i }).count()) ||
      (await admin.getByLabel("Maximum AI Captures", { exact: true }).inputValue()) !==
        String(limit)
    )
      throw Error("Staging draft already in progress");
    phase = "EDIT_ALLOWANCE";
    await admin.getByLabel("Maximum AI Captures", { exact: true }).fill(String(target));
    await admin.getByLabel("Change note").fill(note);
    await admin.getByRole("button", { name: "Save as new version", exact: true }).click();
    const row = admin.getByRole("row").filter({ hasText: note });
    const { data: draft, error } = await db
      .from("plan_versions")
      .select("id")
      .eq("notes", note)
      .maybeSingle();
    if (error) throw error;
    phase = "SAVE_DRAFT";
    await row.waitFor();
    const edited =
      draft ?? (await db.from("plan_versions").select("id").eq("notes", note).single()).data;
    if (!edited) throw Error("Missing fixture draft");
    try {
      phase = "PUBLISH";
      await row.getByRole("button", { name: "Approve", exact: true }).click();
      await row.getByRole("cell", { name: /^approved$/i }).waitFor();
      for (const path of ["/pricing", "/app/plans", "/app/billing"]) {
        phase =
          path === "/pricing"
            ? "PUBLIC_PRICING"
            : path === "/app/plans"
              ? "APP_PLANS"
              : "BILLING_METER";
        await page.goto(base + path);
        await page
          .getByText(new RegExp("\\b" + target + " AI captures/mo"))
          .first()
          .waitFor();
      }
      await page.getByText(new RegExp("Account AI captures.* / " + target + " ")).waitFor();
      phase = "RUNTIME";
      const runtime = await db.rpc("account_entitlements", { _user: userId });
      if (runtime.error || runtime.data?.ai_captures?.limit !== target)
        throw Error("Runtime did not adopt approved version");
    } finally {
      if ((await approved()).id === edited.id) {
        // Restore the original approved version with the same normal Admin action.
        await admin
          .getByRole("row")
          .filter({ has: admin.getByRole("cell", { name: "v" + before.version, exact: true }) })
          .getByRole("button", { name: "Approve", exact: true })
          .click();
        await admin
          .getByRole("row")
          .filter({ has: admin.getByRole("cell", { name: "v" + before.version, exact: true }) })
          .getByRole("cell", { name: /^approved$/i })
          .waitFor();
      }
      if ((await approved()).id !== before.id) throw Error("Approved plan changed concurrently");
    }
  } catch {
    throw Object.assign(new Error("Plan propagation check failed"), {
      safeStage: phase + "_FAILED",
    });
  }
}
