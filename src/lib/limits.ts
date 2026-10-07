export const DAILY_MESSAGE_LIMIT = 25;

export interface DailyUsage {
  used: number;
  limit: number;
  remaining: number;
}
