import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { clearUser, openApp, sql } from "./helpers";

const USER = "e2e-smoke-user";

test.afterAll(() => clearUser(USER));

async function waitForReply(page: import("@playwright/test").Page, minBubbles = 1, timeout = 150_000) {
  await page.waitForFunction(
    (min) =>
      document.querySelectorAll('[data-role="assistant"]').length >= min ||
      document.querySelector('[data-testid="chat-error"]') !== null,
    minBubbles,
    { timeout }
  );
  return page.evaluate(() => {
    const bubbles = document.querySelectorAll('[data-role="assistant"]');
    return {
      reply: bubbles[bubbles.length - 1]?.textContent?.trim() ?? "",
      error: document.querySelector('[data-testid="chat-error"]')?.textContent?.trim() ?? "",
    };
  });
}

test("live providers: APInex text + OpenRouter file reply", async ({ page }) => {
  test.setTimeout(300_000);
  clearUser(USER);
  sql(`DELETE FROM provider_usage WHERE user_id='__global__';`);

  await openApp(page, USER);
  await page.type('textarea[placeholder*="Message SK-AI"]', "Reply with exactly: APINEX_OK");
  await page.keyboard.press("Enter");
  const text = await waitForReply(page);
  if (text.error) {
    console.log(`smoke apinex skip: ${text.error}`);
    test.skip(true, `APInex upstream degraded: ${text.error}`);
  }
  console.log(`smoke apinex reply: ${text.reply.slice(0, 120)}`);
  expect(text.reply.length).toBeGreaterThan(0);

  const meta = await page.evaluate(() => {
    const row = document.querySelector('[data-role="assistant"]');
    return [...(row?.querySelectorAll("p") ?? [])].map((p) => p.textContent ?? "").join(" | ");
  });
  expect(meta).toMatch(/· .+/); // "09:12 PM · <model name>" under the bubble

  const sample = `${process.env.TEMP ?? "/tmp"}/skai-smoke-file.txt`;
  fs.writeFileSync(sample, "smoke: the secret word is BANANA_SPLIT");
  await page.setInputFiles('input[type="file"]', sample);
  await page.waitForFunction(
    () => document.body.innerText.includes("skai-smoke-file.txt"),
    undefined,
    { timeout: 10000 }
  );
  await page.type('textarea[placeholder*="Message SK-AI"]', "Reply with exactly: BANANA_SPLIT");
  await page.keyboard.press("Enter");
  const fileReply = await waitForReply(page, 2);
  if (fileReply.error) {
    console.log(`smoke file skip: ${fileReply.error}`);
    test.skip(true, `OpenRouter upstream degraded: ${fileReply.error}`);
  }
  console.log(`smoke openrouter reply: ${fileReply.reply.slice(0, 120)}`);
  expect(fileReply.reply.length).toBeGreaterThan(0);
});
