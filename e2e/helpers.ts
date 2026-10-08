import { execSync } from "node:child_process";
import path from "node:path";
import type { Page } from "@playwright/test";

export const REPO = path.resolve(import.meta.dirname, "..");
export const SHOTS = path.join(REPO, "e2e", "screenshots");
export const BASE = "http://localhost:5173";
export const TODAY = new Date().toISOString().slice(0, 10);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function sql(command: string) {
  execSync(`npx wrangler d1 execute sk-ai-db --local --command "${command}"`, {
    cwd: REPO,
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 60000,
  });
}

export function clearUser(userId: string) {
  sql(
    `DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id='${userId}'); DELETE FROM files WHERE user_id='${userId}'; DELETE FROM conversations WHERE user_id='${userId}'; DELETE FROM provider_usage WHERE user_id='${userId}';`
  );
}

export async function openApp(page: Page, userId: string) {
  await page.addInitScript((u) => localStorage.setItem("sk-ai-user-id", u), userId);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
}

export async function shot(page: Page, file: string) {
  await page.screenshot({ path: path.join(SHOTS, file) });
  console.log(`shot: e2e/screenshots/${file}`);
}

export const bodyText = (page: Page) => page.evaluate(() => document.body.innerText);

export const innerTextContains = (page: Page, text: string, timeout = 5000) =>
  page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    text,
    { timeout }
  );
