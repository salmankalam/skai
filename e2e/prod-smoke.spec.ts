import { test, expect } from "@playwright/test";

// Opt-in live check against production: PROD_SMOKE=1 npx playwright test e2e/prod-smoke.spec.ts
test("production smoke", async ({ page }) => {
  test.skip(!process.env.PROD_SMOKE, "set PROD_SMOKE=1 to hit the live deployment");
  test.setTimeout(300_000);
  const USER = "prod-smoke-user";
  await page.addInitScript((u) => localStorage.setItem("sk-ai-user-id", u), USER);
  await page.goto("https://sk-ai.salmankalam123.workers.dev", { waitUntil: "networkidle" });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 30000 });

  // 1) text chat
  await page.type('textarea[placeholder*="Message SK-AI"]', "Reply with exactly: PROD_OK");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelector('[data-role="assistant"]')?.textContent?.trim().length ||
      document.querySelector('[data-testid="chat-error"]') !== null,
    undefined,
    { timeout: 150000 }
  );
  const text = await page.evaluate(() => ({
    reply: document.querySelector('[data-role="assistant"]')?.textContent ?? "",
    error: document.querySelector('[data-testid="chat-error"]')?.textContent ?? "",
  }));
  console.log("TEXT REPLY:", text.reply.slice(0, 80), "ERROR:", text.error.slice(0, 150));
  expect(text.error).toBe("");
  expect(text.reply.length).toBeGreaterThan(0);

  // 2) file upload → stored in prod D1 → OpenRouter answers
  const fs = await import("node:fs");
  const sample = `${process.env.TEMP ?? "/tmp"}/prod-smoke.txt`;
  fs.writeFileSync(sample, "The secret word in this file is BANANA_SPLIT");
  await page.setInputFiles('input[type="file"]', sample);
  await page.waitForFunction(
    () => document.body.innerText.includes("prod-smoke.txt"),
    undefined,
    { timeout: 15000 }
  );
  await page.type('textarea[placeholder*="Message SK-AI"]', "What is the secret word? Reply with just the word.");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-role="assistant"]').length >= 2 ||
      document.querySelector('[data-testid="chat-error"]') !== null,
    undefined,
    { timeout: 150000 }
  );
  const file = await page.evaluate(() => {
    const bubbles = document.querySelectorAll('[data-role="assistant"]');
    return {
      reply: bubbles[bubbles.length - 1]?.textContent ?? "",
      error: document.querySelector('[data-testid="chat-error"]')?.textContent ?? "",
    };
  });
  console.log("FILE REPLY:", file.reply.slice(0, 120), "ERROR:", file.error.slice(0, 150));
  expect(file.error).toBe("");
  expect(file.reply.toUpperCase()).toContain("BANANA");

  // 3) notification bell shows the file-request record
  await page.click('[data-testid="notif-bell"]');
  await page.waitForSelector('[data-testid="notif-panel"]', { timeout: 5000 });
  const panel = await page.textContent('[data-testid="notif-panel"]');
  console.log("PANEL has request record:", panel?.includes("OpenRouter request recorded"));
  expect(panel).toContain("OpenRouter request recorded");
  await page.screenshot({ path: "e2e/screenshots/prod-live.png" });
});
