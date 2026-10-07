import { createServerFn } from "@tanstack/react-start";
import { DAILY_MESSAGE_LIMIT, type DailyUsage } from "../lib/limits";
import { countTodayMessages } from "./daily-limit";

export const getDailyUsage = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<DailyUsage> => {
    const used = await countTodayMessages(data.userId);
    return {
      used,
      limit: DAILY_MESSAGE_LIMIT,
      remaining: Math.max(0, DAILY_MESSAGE_LIMIT - used),
    };
  });
