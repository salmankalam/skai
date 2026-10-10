import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { clearUser, openApp, shot, bodyText, innerTextContains, sleep, BASE } from "./helpers";

const USER = "e2e-core-user";

test.afterAll(() => clearUser(USER));

test("core flows", async ({ page }) => {
  test.setTimeout(120_000);
  clearUser(USER);

  await test.step("loads new UI + empty sidebar (D1)", async () => {
    await openApp(page, USER);
    const body = await bodyText(page);
    expect(body).toContain("Welcome to SK-AI");
    expect(body).not.toContain("React Performance Tips");
    expect(body).toContain("No conversations yet");
  });

  await test.step("default model = Agnes 2.5 Flash (NaraRouter)", async () => {
    const modelBtn = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Agnes"));
      return b ? b.textContent.trim() : null;
    });
    expect(modelBtn).toBe("NaraRouter/Agnes 2.5 Flash");
  });

  await test.step("usage badge visible", async () => {
    await innerTextContains(page, "25 of 25", 15000);
    expect(await bodyText(page)).toContain("25 of 25");
  });

  await test.step("dropdown lists free NaraRouter models only", async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Agnes"));
      b.click();
    });
    await innerTextContains(page, "SELECT MODEL", 5000);
    await sleep(200);
    const menuText = await bodyText(page);
    const freeNames = [
      "Agnes 2.5 Flash",
      "Laguna S 2.1",
      "Ling 3.0 Flash Sante",
      "Nemotron 3 Super Free",
      "Nemotron 3 Ultra Free",
      "Nemotron 3.5 Lightning",
    ];
    expect(freeNames.filter((n) => !menuText.includes(n))).toEqual([]);
    expect(menuText).not.toMatch(/GPT-4|Claude|MiniMax M3|Qwen3\.8/);
    await shot(page, "core-1-models.png");
    await page.mouse.click(700, 100);
    await sleep(300);
  });

  await test.step("file chip appears after attach (D1 upload)", async () => {
    const sample = `${process.env.TEMP ?? "/tmp"}/skai-sample-note.txt`;
    fs.writeFileSync(sample, "Hello from the e2e file attachment test.\nSecond line.");
    await page.setInputFiles('input[type="file"]', sample);
    await innerTextContains(page, "skai-sample-note.txt", 8000);
    await shot(page, "core-2-attach.png");
  });

  await test.step("file send reaches OpenRouter (error or response)", async () => {
    await page.type('textarea[placeholder*="Message SK-AI"]', "Hello from core e2e");
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document.querySelector('[data-role="assistant"]') ||
        document.querySelector('[data-testid="chat-error"]'),
      undefined,
      { timeout: 90000 }
    );
    expect(await bodyText(page)).toContain("Hello from core e2e");
    await shot(page, "core-3-error.png");
  });

  await test.step("conversation persists after reload (D1 read)", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
    await innerTextContains(page, "Hello from core e2e", 15000);
  });

  await test.step("sidebar search filters", async () => {
    await page.type('input[placeholder="Search conversations..."]', "core");
    await sleep(400);
    expect(await bodyText(page)).toContain("Hello from core e2e");
  });
});
