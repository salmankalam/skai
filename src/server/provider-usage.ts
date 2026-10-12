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

/** Clock-minute bucket (UTC): minutes since epoch. */
export function currentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/**
 * Checks the per-minute window and consumes one slot if under the limit.
 * Windows are clock minutes (resets each minute, no rolling state).
 */
export async function checkAndConsumeMinute(
  userId: string,
  provider: ProviderRoute,
  limit: number
): Promise<boolean> {
  const minute = currentMinute();
  const row = await env.DB.prepare(
    `SELECT count FROM rate_windows WHERE user_id = ? AND provider = ? AND window_start = ?`
  )
    .bind(userId, provider, minute)
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= limit) return false;
  await env.DB.prepare(
    `INSERT INTO rate_windows (user_id, provider, window_start, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, provider, window_start) DO UPDATE SET count = count + 1`
  )
    .bind(userId, provider, minute)
    .run();
  // Opportunistic cleanup of stale rows (best effort, ~10% of calls).
  if (Math.random() < 0.1) {
    await env.DB.prepare(`DELETE FROM rate_windows WHERE window_start < ?`)
      .bind(minute - 2)
      .run()
      .catch(() => {});
  }
  return true;
}
