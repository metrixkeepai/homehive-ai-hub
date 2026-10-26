import { createClient } from "@supabase/supabase-js";

/**
 * Idempotent Control Centre bootstrap.
 *
 * SUPER_ADMIN_EMAIL — required to run bootstrap; skipped when unset.
 * SUPER_ADMIN_PASSWORD — required only when the account must be created.
 * SUPER_ADMIN_RESET_PASSWORD=true — force-update password for an existing account.
 *
 * Never overwrites an existing password on normal restarts.
 */
export async function ensureSuperAdmin(env = process.env) {
  const email = (env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    console.info(
      JSON.stringify({
        event: "super_admin_bootstrap_skipped",
        reason: "SUPER_ADMIN_EMAIL unset",
      }),
    );
    return { status: "skipped" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SUPER_ADMIN_EMAIL is not a valid email address");
  }

  const password = env.SUPER_ADMIN_PASSWORD ?? "";
  const resetPassword = env.SUPER_ADMIN_RESET_PASSWORD === "true";
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin credentials are required to bootstrap Super Admin");
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await findUserByEmail(db, email);
  let userId = user?.id ?? null;
  let created = false;

  if (!userId) {
    if (!password || password.length < 12) {
      throw new Error(
        "SUPER_ADMIN_PASSWORD (min 12 chars) is required to create the Super Admin account",
      );
    }
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "MatrixKeep Super Admin" },
      app_metadata: { must_change_password: true },
    });
    if (error) throw new Error(`Super Admin create failed: ${error.message}`);
    userId = data.user.id;
    created = true;
  } else {
    const patch = {};
    if (!user.email_confirmed_at) patch.email_confirm = true;
    if (user.banned_until) patch.ban_duration = "none";
    if (resetPassword) {
      if (!password || password.length < 12) {
        throw new Error(
          "SUPER_ADMIN_PASSWORD (min 12 chars) is required when SUPER_ADMIN_RESET_PASSWORD=true",
        );
      }
      patch.password = password;
      patch.app_metadata = {
        ...(user.app_metadata ?? {}),
        must_change_password: true,
      };
    }
    if (Object.keys(patch).length) {
      const { error } = await db.auth.admin.updateUserById(userId, patch);
      if (error) throw new Error(`Super Admin update failed: ${error.message}`);
    }
  }

  const { data: role, error: roleReadError } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (roleReadError) throw new Error(`Super Admin role check failed: ${roleReadError.message}`);

  let roleGranted = false;
  if (!role) {
    const { error: roleError } = await db
      .from("user_roles")
      .insert({ user_id: userId, role: "super_admin" });
    if (roleError) throw new Error(`Super Admin role grant failed: ${roleError.message}`);
    roleGranted = true;
  }

  await db.from("profiles").update({ suspended: false }).eq("id", userId);

  if (created || roleGranted || resetPassword) {
    await db.from("admin_audit_log").insert({
      admin_id: userId,
      action: created
        ? "super_admin_bootstrapped"
        : resetPassword
          ? "super_admin_password_reset"
          : "super_admin_role_ensured",
      target: userId,
      reason: "Server bootstrap ensureSuperAdmin",
      details: { email, created, roleGranted, resetPassword },
    });
  }

  console.info(
    JSON.stringify({
      event: "super_admin_bootstrap",
      email,
      user_id: userId,
      created,
      role_granted: roleGranted,
      password_reset: resetPassword,
    }),
  );

  return { status: "ok", email, userId, created, roleGranted, resetPassword };
}

async function findUserByEmail(db, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Super Admin lookup failed: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) return match;
    if (users.length < 1000) return null;
  }
  return null;
}
