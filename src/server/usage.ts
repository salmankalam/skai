import { createServerFn } from "@tanstack/react-start";
import {
  DAILY_MESSAGE_LIMIT,
  FILE_DAILY_LIMIT,
  OPENROUTER_GLOBAL_LIMIT,
  type DailyUsage,
} from "../lib/limits";
import { getUsage, getGlobalUsage } from "./provider-usage";

export const getDailyUsage = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<DailyUsage> => {
    const [textUsed, fileUsed, globalUsed] = await Promise.all([
      getUsage(data.userId, "nara"),
      getUsage(data.userId, "openrouter"),
      getGlobalUsage("openrouter"),
    ]);
    return {
      text: {
        used: textUsed,
        limit: DAILY_MESSAGE_LIMIT,
        remaining: Math.max(0, DAILY_MESSAGE_LIMIT - textUsed),
      },
      file: {
        used: fileUsed,
        limit: FILE_DAILY_LIMIT,
        remaining: Math.max(0, FILE_DAILY_LIMIT - fileUsed),
      },
      fileExhausted: globalUsed >= OPENROUTER_GLOBAL_LIMIT,
    };
  });
