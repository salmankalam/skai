/** NaraRouter text chat — per user, per UTC day. */
export const DAILY_MESSAGE_LIMIT = 25;

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
  fileExhausted: boolean;
}
