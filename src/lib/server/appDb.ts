import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * The iPhone's tables, reached only through the security-definer functions in
 * migration 0005, each of which checks APP_SERVER_SECRET. The anon key, not a
 * service-role key: decision 0004.
 */
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const secret = () => process.env.APP_SERVER_SECRET ?? "";

/** True when the server has what the iPhone routes need. */
export function appRoutesConfigured(): boolean {
  return Boolean(process.env.APP_SERVER_SECRET && process.env.APPLE_TEAM_ID);
}

/** The App ID App Attest signs for. */
export function appId(): string {
  return `${process.env.APPLE_TEAM_ID}.com.wpv.spindle`;
}

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(name, { p_secret: secret(), ...args });
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

export const issueChallenge = (challenge: string) =>
  call<void>("app_issue_challenge", { p_challenge: challenge });

export const takeChallenge = (challenge: string) =>
  call<boolean>("app_take_challenge", { p_challenge: challenge });

export const registerKey = (keyId: string, publicKeyPem: string) =>
  call<void>("app_register_key", { p_key_id: keyId, p_public_key: publicKeyPem });

export async function findKey(keyId: string): Promise<{ public_key: string; counter: number } | null> {
  const rows = await call<{ public_key: string; counter: number }[]>("app_key", { p_key_id: keyId });
  return rows?.[0] ?? null;
}

export type KeySpend = "ok" | "unknown" | "replay" | "limit";

export const spendKey = (keyId: string, counter: number, kind: "study" | "plan", hourlyLimit: number) =>
  call<KeySpend>("app_use_key", {
    p_key_id: keyId,
    p_counter: counter,
    p_kind: kind,
    p_hourly_limit: hourlyLimit,
  });
