import { createClient } from "@supabase/supabase-js";
import { findUserByEmail } from "./ensure-super-admin.mjs";

const env = process.env;
const url = env.SUPABASE_URL?.replace(/\/$/, "");
if (env.APP_ENV !== "staging" || url !== "https://cdfpupivjjamhvmfcvry.supabase.co")
  throw Error("Unexpected admin rotation target");

const version = Number(env.ADMIN_PASSWORD_VERSION);
const email = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = env.SUPER_ADMIN_PASSWORD;
if (!Number.isSafeInteger(version) || version < 1 || !email || !password || password.length < 12)
  throw Error("Invalid staging admin secret configuration");
if (/[\r\n]/.test(password)) throw Error("Staging password contains a line break");

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, options);
const auth = createClient(url, env.SUPABASE_PUBLISHABLE_KEY, options);
const user = await findUserByEmail(db, email);
if (!user || !user.email_confirmed_at || Date.parse(user.banned_until ?? "") > Date.now())
  throw Error("Configured admin identity is missing, unconfirmed or banned");
const role = await db
  .from("user_roles")
  .select("id")
  .eq("user_id", user.id)
  .eq("role", "super_admin")
  .maybeSingle();
if (role.error || !role.data) throw Error("Configured identity has no Super Admin role");
const profile = await db.from("profiles").select("suspended").eq("id", user.id).single();
if (profile.error || profile.data.suspended) throw Error("Configured admin profile unavailable");

const previous = Number(user.app_metadata?.matrixkeep_staging_password_version ?? 0);
if (!Number.isSafeInteger(previous) || previous > version) throw Error("Stale credential version");
let login = await auth.auth.signInWithPassword({ email, password });
if (login.error && (login.error.code !== "invalid_credentials" || previous === version))
  throw Error("Configured credential rejected; confirm the enabled secret version");
if (previous < version) {
  const patch = {
    app_metadata: { ...user.app_metadata, matrixkeep_staging_password_version: version },
  };
  if (login.error) patch.password = password;
  const updated = await db.auth.admin.updateUserById(user.id, patch);
  if (updated.error) throw Error("Staging password rotation failed");
  if (login.error) login = await auth.auth.signInWithPassword({ email, password });
}
if (login.error || login.data.user?.id !== user.id)
  throw Error("Rotated credential failed authentication");
await auth.auth.signOut({ scope: "local" });
console.log("Verified staging admin credential version", version);
