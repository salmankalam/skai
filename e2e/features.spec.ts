import fs from "node:fs";
import { test, expect } from "@playwright/test";
import {
  clearUser,
  openApp,
  shot,
  sql,
  bodyText,
  innerTextContains,
  sleep,
  TODAY,
} from "./helpers";

const USER = "e2e-limit-user";

test.beforeAll(() => {
  clearUser(USER);
  sql(`DELETE FROM provider_usage WHERE user_id='__global__';`);
});

test.afterAll(() => {
  clearUser(USER);
  sql(`DELETE FROM provider_usage WHERE user_id='__global__';`);
});

test("features", async ({ page }) => {
  test.setTimeout(240_000);

  await test.step("header badge + footer show daily limit", async () => {
    await openApp(page, USER);
    await innerTextContains(page, "25 of 25", 15000);
    const t1 = await bodyText(page);
    expect(t1).toContain("Free plan · 25 of 25 messages left today");
    expect(t1).toContain("25 free messages/day");
  });

  await test.step("notices centered, usage badge on far right", async () => {
    const layout = await page.evaluate(() => {
      const header = document.querySelector("header")?.getBoundingClientRect();
      const notices = document.querySelector('[data-testid="header-notices"]')?.getBoundingClientRect();
      const badge = document.querySelector('span[title^="Messages used today"]')?.getBoundingClientRect();
      return {
        noticesCenter: notices ? notices.left + notices.width / 2 : null,
        headerCenter: header ? header.left + header.width / 2 : null,
        badgeRight: badge ? Math.round(badge.right) : null,
        headerRight: header ? Math.round(header.right) : null,
      };
    });
    expect(layout.noticesCenter).not.toBeNull();
    expect(Math.abs(layout.noticesCenter! - layout.headerCenter!)).toBeLessThan(2);
    expect(layout.badgeRight!).toBeGreaterThan(layout.headerRight! - 60);
  });

  await test.step("Legal/Privacy/Features tooltips show content and fade", async () => {
    await page.hover('button[aria-label="Legal"]');
    await sleep(400);
    const legal = await bodyText(page);
    expect(legal).toContain("data breach");
    expect(legal).toContain("as is");

    await page.hover('button[aria-label="Privacy Policy"]');
    await sleep(400);
    const priv = await bodyText(page);
    expect(priv).toContain("APInex and OpenRouter");
    expect(priv).toContain("never sold");

    await page.hover('button[aria-label="Features"]');
    await sleep(400);
    const feat = await bodyText(page);
    expect(feat).toContain("File Q&A");
    expect(feat).toContain("25 messages per day");
    await shot(page, "feat-1b-header-notices.png");

    await page.mouse.move(700, 500);
    await sleep(500);
    const noticeTipOpacity = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Features"]');
      const tip = btn?.parentElement?.querySelector('[role="tooltip"]');
      return tip ? getComputedStyle(tip).opacity : null;
    });
    expect(noticeTipOpacity).toBe("0");
  });

  await test.step("file tooltip appears on hover and fades out", async () => {
    await page.hover('[aria-label="Attach files"]');
    await sleep(400);
    const tipIn = await bodyText(page);
    expect(tipIn).toContain("Drop any file here");
    expect(tipIn).toContain(".pdf");
    expect(tipIn).toContain("5 MB");
    const fileTipOpacity = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Attach files"]');
      const tip = btn?.parentElement?.querySelector('[role="tooltip"]');
      return tip ? getComputedStyle(tip).opacity : null;
    });
    expect(fileTipOpacity).toBe("1");
    await shot(page, "feat-1-tooltip.png");

    await page.mouse.move(5, 5);
    await sleep(600);
    const tipOpacityOut = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Attach files"]');
      const tip = btn?.parentElement?.querySelector('[role="tooltip"]');
      return tip ? getComputedStyle(tip).opacity : null;
    });
    expect(tipOpacityOut).toBe("0");
  });

  await test.step("minute limit (5/min) blocks burst sends (server-enforced)", async () => {
    const thisMinute = Math.floor(Date.now() / 60000);
    sql(
      `INSERT INTO rate_windows (user_id, provider, window_start, count) VALUES ('${USER}','apinex',${thisMinute},5) ON CONFLICT(user_id, provider, window_start) DO UPDATE SET count = 5;`
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
    await page.type('textarea[placeholder*="Message SK-AI"]', "burst should be blocked");
    await page.keyboard.press("Enter");
    await innerTextContains(page, "requests per minute", 20000);
    await shot(page, "feat-1c-minute-limit.png");
  });

  await test.step("send blocked at 25/day limit (server-enforced)", async () => {
    sql(
      `INSERT INTO provider_usage (user_id, provider, day, count) VALUES ('${USER}','apinex','${TODAY}',25) ON CONFLICT(user_id, provider, day) DO UPDATE SET count = 25;`
    );
    await page.reload({ waitUntil: "networkidle" });
    await innerTextContains(page, "0 of 25 messages left today", 15000);
    expect(await bodyText(page)).toContain("midnight UTC");
    await shot(page, "feat-2-limit-badge.png");

    await page.type('textarea[placeholder*="Message SK-AI"]', "should be blocked");
    await page.keyboard.press("Enter");
    await innerTextContains(page, "messages per day per user", 20000);
    await shot(page, "feat-3-limit-error.png");
  });

  await test.step("mobile: sidebar, stacked cards, toggle, dropdown fit", async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
    await sleep(600);

    const closedX = await page.$eval("aside", (el) => el.getBoundingClientRect().right);
    expect(closedX).toBeLessThanOrEqual(1);

    const cards = await page.$$eval("main button", (btns) =>
      btns
        .filter((b) => /Write code|Explain a topic|Brainstorm ideas/.test(b.textContent))
        .map((b) => Math.round(b.getBoundingClientRect().x))
    );
    expect(cards.length).toBe(3);
    expect(new Set(cards).size).toBe(1);
    await shot(page, "feat-4-mobile.png");

    await page.click('button[aria-label="Open sidebar"]');
    await sleep(500);
    const openX = await page.$eval("aside", (el) => el.getBoundingClientRect().right);
    const backdrop = await page.$$eval("div", (ds) =>
      ds.some((d) => d.className.includes("z-30") && d.className.includes("fixed"))
    );
    expect(openX).toBeGreaterThan(200);
    expect(backdrop).toBe(true);
    await shot(page, "feat-5-mobile-sidebar.png");

    await page.mouse.click(350, 300);
    await sleep(500);
    const closedX2 = await page.$eval("aside", (el) => el.getBoundingClientRect().right);
    expect(closedX2).toBeLessThanOrEqual(1);

    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => /Qwen|Deepseek|GPT 6|GLM|Mimo/.test(x.textContent) && x.closest(".relative")
      );
      b?.click();
    });
    await sleep(400);
    const dd = await page.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find(
        (d) => d.textContent.includes("Select Model") && d.className.includes("w-72")
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    });
    expect(dd).not.toBeNull();
    expect(dd!.left).toBeGreaterThanOrEqual(0);
    expect(dd!.right).toBeLessThanOrEqual(375);
    await shot(page, "feat-6-mobile-dropdown.png");
  });

  const sample = `${process.env.TEMP ?? "/tmp"}/skai-feat-file.txt`;
  fs.writeFileSync(sample, "file mode e2e sample");
  const attachFile = async () => {
    await page.setInputFiles('input[type="file"]', sample);
    await innerTextContains(page, "skai-feat-file.txt", 8000);
  };

  await test.step("file mode: badge, notice, OpenRouter file models", async () => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });

    await attachFile();
    await innerTextContains(page, "OpenRouter requests left today", 15000);
    const fm = await bodyText(page);
    expect(fm).toContain("5 of 5");
    expect(fm).toContain("File task");
    expect(fm).toContain("OpenRouter");

    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => /Gemma|Inkling|Nemotron|Free Router/.test(x.textContent) && x.closest(".relative")
      );
      b?.click();
    });
    // header is text-transform:uppercase, so innerText comes back uppercased
    await innerTextContains(page, "FILE TASK — MODELS THAT SUPPORT FILES", 5000);
    const fmMenu = await bodyText(page);
    expect(fmMenu).toContain("Gemma 4 31B");
    expect(fmMenu).toContain("Nemotron 3 Nano Omni");
    expect(fmMenu).toContain("OpenRouter");
    expect(fmMenu).not.toContain("Qwen 3.8 MAX");
    await shot(page, "feat-7-file-models.png");
    await page.mouse.click(700, 100);
    await sleep(300);
  });

  await test.step("file send blocked at 5/day (server-enforced)", async () => {
    sql(
      `INSERT INTO provider_usage (user_id, provider, day, count) VALUES ('${USER}','openrouter','${TODAY}',5) ON CONFLICT(user_id, provider, day) DO UPDATE SET count = 5;`
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
    await attachFile();
    await innerTextContains(page, "OpenRouter request limit reached", 15000);
    await shot(page, "feat-8-file-limit-badge.png");

    await page.type('textarea[placeholder*="Message SK-AI"]', "should be file-blocked");
    await page.keyboard.press("Enter");
    await innerTextContains(page, "OpenRouter request limit reached", 20000);
    await shot(page, "feat-9-file-limit-error.png");
  });

  await test.step("global 50/day quota blocks all OpenRouter requests", async () => {
    sql(
      `INSERT INTO provider_usage (user_id, provider, day, count) VALUES ('__global__','openrouter','${TODAY}',50) ON CONFLICT(user_id, provider, day) DO UPDATE SET count = 50;`
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
    await attachFile();
    await innerTextContains(page, "OpenRouter quota reached", 15000);

    await page.type('textarea[placeholder*="Message SK-AI"]', "global block test");
    await page.keyboard.press("Enter");
    await innerTextContains(page, "OpenRouter's free requests are being used", 20000);
    const gq = await bodyText(page);
    expect(gq).toContain("Text chat via APInex still works");
    expect(gq).not.toContain("50");
    await shot(page, "feat-10-global-quota.png");
  });

  await test.step("APInex text path unaffected by OpenRouter block", async () => {
    // fresh page → default model is APInex; apinex usage is at 25 from the
    // earlier seed → apinex limit error, proving the apinex path still works
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
    await page.type('textarea[placeholder*="Message SK-AI"]', "text while openrouter blocked");
    await page.keyboard.press("Enter");
    await innerTextContains(page, "messages per day per user", 20000);
    const errBanner = await page.textContent('[data-testid="chat-error"]');
    expect(errBanner).not.toContain("OpenRouter's free requests");
    await shot(page, "feat-11-text-still-works.png");
  });

  await test.step("notifications: bell persists quota decisions + toast", async () => {
    await page.waitForSelector('[data-testid="toast"]', { timeout: 10000 });
    const toastText = await page.textContent('[data-testid="toast"]');
    expect(toastText).toContain("midnight UTC");

    await page.click('[data-testid="notif-bell"]');
    await page.waitForSelector('[data-testid="notif-panel"]', { timeout: 5000 });
    const panel = await page.textContent('[data-testid="notif-panel"]');
    expect(panel).toContain("OpenRouter's free requests are being used");
    expect(panel).toContain("OpenRouter request limit reached");
    expect(panel).toContain("messages per day per user");
    expect(panel).toContain("requests per minute");
    expect(panel).not.toContain("50");
    await page.waitForSelector('[data-testid="notif-badge"]', { state: "detached", timeout: 5000 });
    await shot(page, "feat-12-notifications.png");
  });
});
