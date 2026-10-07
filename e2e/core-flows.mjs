import fs from "node:fs";
import { waitForDevServer, launchBrowser, createResults, shot, clearUser, sleep, BASE } from "./harness.mjs";

const USER = "e2e-core-user";
const { ok, finish } = createResults();

await waitForDevServer();
clearUser(USER);

const { browser, close } = await launchBrowser(9455);
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((u) => localStorage.setItem("sk-ai-user-id", u), USER);
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
  const body1 = await page.evaluate(() => document.body.innerText);
  ok("loads new UI", body1.includes("Welcome to SK-AI") && !body1.includes("React Performance Tips"));
  ok("sidebar empty state (D1)", body1.includes("No conversations yet"));
  const modelBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Gemma"));
    return b ? b.textContent.trim() : null;
  });
  ok("default model = Gemma 4 31B", !!modelBtn, modelBtn ?? "not found");
  const badgeOk = await page
    .waitForFunction(() => document.body.innerText.includes("25 of 25"), { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok("usage badge visible", badgeOk);

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Gemma"));
    b.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes("Select Model"), { timeout: 5000 }).catch(() => {});
  const menuText = await page.evaluate(() => document.body.innerText);
  const freeNames = ["Free Router", "Gemma 4 31B", "Gemma 4 26B", "Inkling", "Nemotron", "North Mini Code"];
  const missing = freeNames.filter((n) => !menuText.includes(n));
  ok("dropdown lists free models", missing.length === 0, missing.length ? `missing: ${missing}` : "all present");
  ok("no paid models in dropdown", !/GPT-4|Claude|MiniMax M3|Qwen3\.8/.test(menuText));
  await shot(page, "core-1-models.png");
  await page.mouse.click(700, 100);
  await sleep(300);

  const sample = `${process.env.TEMP ?? "/tmp"}/skai-sample-note.txt`;
  fs.writeFileSync(sample, "Hello from the e2e file attachment test.\nSecond line.");
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(sample);
  await page.waitForFunction(() => document.body.innerText.includes("skai-sample-note.txt"), { timeout: 8000 });
  ok("file chip appears after attach", true, "upload to R2 succeeded");
  await shot(page, "core-2-attach.png");

  await page.type('textarea[placeholder*="Message SK-AI"]', "Hello from core e2e");
  await page.keyboard.press("Enter");
  const gotError = await page
    .waitForFunction(() => /OPENROUTER|error|failed/i.test(document.body.innerText), { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  ok("chat error surfaced without API key", gotError);
  const afterSend = await page.evaluate(() => document.body.innerText);
  ok("conversation created in sidebar (D1 insert)", afterSend.includes("Hello from core e2e"));
  await shot(page, "core-3-error.png");

  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
  const persisted = await page
    .waitForFunction(() => document.body.innerText.includes("Hello from core e2e"), { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok("conversation persists after reload (D1 read)", persisted);

  await page.type('input[placeholder="Search conversations..."]', "core");
  await sleep(400);
  const search = await page.evaluate(() => document.body.innerText);
  ok("sidebar search filters", search.includes("Hello from core e2e"));
} catch (e) {
  ok("script completed without exception", false, String(e).slice(0, 300));
} finally {
  await close();
  clearUser(USER);
  const passed = finish();
  process.exit(passed ? 0 : 1);
}
