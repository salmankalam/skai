import { env } from "cloudflare:workers";
import { GLOBAL_USER } from "../lib/limits";
import type { ProviderRoute } from "../lib/types";

/** UTC day key: YYYY-MM-DD. */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getUsage(userId: string, provider: ProviderRoute): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT count FROM provider_usage WHERE user_id = ? AND provider = ? AND day = ?`
  )
    .bind(userId, provider, todayKey())
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getGlobalUsage(provider: ProviderRoute): Promise<number> {
  return getUsage(GLOBAL_USER, provider);
}

export async function incrementUsage(userId: string, provider: ProviderRoute): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO provider_usage (user_id, provider, day, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, provider, day) DO UPDATE SET count = count + 1`
  )
    .bind(userId, provider, todayKey())
    .run();
}

/** Force the global quota row to the given count (used when the provider says we're out). */
export async function setGlobalUsage(
  provider: ProviderRoute,
  count: number
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO provider_usage (user_id, provider, day, count) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, provider, day) DO UPDATE SET count = MAX(count, excluded.count)`
  )
    .bind(GLOBAL_USER, provider, todayKey(), count)
    .run();
}
