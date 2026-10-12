/** APInex text chat — per user, per UTC day. */
export const DAILY_MESSAGE_LIMIT = 25;

/** APInex text chat — per user, per minute (matches their free-tier rpm). */
export const APINEX_MINUTE_LIMIT = 5;

/**
 * Our single API key's real throughput on the free tier is 5 rpm shared by
 * all users — internal guard only, never surfaced (busy error instead).
 */
export const APINEX_GLOBAL_RPM = 5;

/** OpenRouter file-based tasks — per user, per UTC day. */
export const FILE_DAILY_LIMIT = 5;

/** OpenRouter provider-wide cap (their free plan ≈ 50 requests/day). */
export const OPENROUTER_GLOBAL_LIMIT = 50;

/** Pseudo user_id used for provider-wide (global) quota rows. */
export const GLOBAL_USER = "__global__";

export interface ProviderUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface DailyUsage {
  text: ProviderUsage;
  file: ProviderUsage;
  fileGlobal: ProviderUsage;
  fileExhausted: boolean;
}
