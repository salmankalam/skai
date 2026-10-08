import fs from "node:fs";
import {
  waitForDevServer,
  launchBrowser,
  createResults,
  shot,
  clearUser,
  sql,
  sleep,
  BASE,
} from "./harness.mjs";

const USER = "e2e-limit-user";
const TODAY = new Date().toISOString().slice(0, 10);
const { ok, finish } = createResults();

await waitForDevServer();
clearUser(USER);
sql(`DELETE FROM provider_usage WHERE user_id='__global__';`);

const { browser, close } = await launchBrowser(9461);
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((u) => localStorage.setItem("sk-ai-user-id", u), USER);
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
  await page.waitForFunction(() => document.body.innerText.includes("25 of 25"), { timeout: 15000 });
  const t1 = await page.evaluate(() => document.body.innerText);
  ok("usage badge shows 25 of 25", t1.includes("messages left today"));
  ok("footer mentions daily limit", t1.includes("25 free messages/day"));

  await page.hover('[aria-label="Attach files"]');
  await sleep(400);
  const tipIn = await page.evaluate(() => document.body.innerText);
  ok(
    "tooltip appears on hover",
    tipIn.includes("Drop any file here") && tipIn.includes(".pdf") && tipIn.includes("5 MB")
  );
  await shot(page, "feat-1-tooltip.png");
  await page.mouse.move(5, 5);
  await sleep(400);
  const tipOut = await page.evaluate(() => document.body.innerText);
  ok("tooltip hides on hover-out", !tipOut.includes("Drop any file here"));

  sql(
    `INSERT INTO provider_usage (user_id, provider, day, count) VALUES ('${USER}','nara','${TODAY}',25) ON CONFLICT(user_id, provider, day) DO UPDATE SET count = 25;`
  );

  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes("Daily limit reached"), { timeout: 15000 });
  const t2 = await page.evaluate(() => document.body.innerText);
  ok("badge shows limit reached", t2.includes("midnight UTC"));
  await shot(page, "feat-2-limit-badge.png");

  await page.type('textarea[placeholder*="Message SK-AI"]', "should be blocked");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.innerText.includes("messages per day per user"), { timeout: 20000 });
  ok("send blocked at limit (server-enforced)", true);
  await shot(page, "feat-3-limit-error.png");

  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
  await sleep(600);
  const closedX = await page.$eval("aside", (el) => el.getBoundingClientRect().right);
  ok("mobile: sidebar hidden by default", closedX <= 1, `right=${Math.round(closedX)}`);
  const cards = await page.$$eval("main button", (btns) =>
    btns
      .filter((b) => /Write code|Explain a topic|Brainstorm ideas/.test(b.textContent))
      .map((b) => Math.round(b.getBoundingClientRect().x))
  );
  ok(
    "mobile: suggestion cards stacked",
    cards.length === 3 && cards[0] === cards[1] && cards[1] === cards[2],
    JSON.stringify(cards)
  );
  await shot(page, "feat-4-mobile.png");

  await page.click('button[aria-label="Open sidebar"]');
  await sleep(500);
  const openX = await page.$eval("aside", (el) => el.getBoundingClientRect().right);
  const backdrop = await page.$$eval("div", (ds) =>
    ds.some((d) => d.className.includes("z-30") && d.className.includes("fixed"))
  );
  ok("mobile: toggle opens sidebar", openX > 200, `right=${Math.round(openX)}`);
  ok("mobile: backdrop shown", backdrop);
  await shot(page, "feat-5-mobile-sidebar.png");

  await page.mouse.click(350, 300);
  await sleep(500);
  const closedX2 = await page.$eval("aside", (el) => el.getBoundingClientRect().right);
  ok("mobile: backdrop closes sidebar", closedX2 <= 1, `right=${Math.round(closedX2)}`);

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => /Agnes|Exo|Jev|Laguna/.test(x.textContent) && x.closest(".relative")
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
  ok("mobile: model dropdown fits viewport", !!dd && dd.left >= 0 && dd.right <= 375, JSON.stringify(dd));
  await shot(page, "feat-6-mobile-dropdown.png");

  // ---- file mode: attachments route to OpenRouter's free file-capable models ----
  await page.setViewport({ width: 1400, height: 900 });
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });

  const sample = `${process.env.TEMP ?? "/tmp"}/skai-feat-file.txt`;
  fs.writeFileSync(sample, "file mode e2e sample");
  const attachFile = async () => {
    const input = await page.$('input[type="file"]');
    await input.uploadFile(sample);
    await page.waitForFunction(() => document.body.innerText.includes("skai-feat-file.txt"), {
      timeout: 8000,
    });
  };

  await attachFile();
  await page.waitForFunction(() => document.body.innerText.includes("file requests left today"), {
    timeout: 15000,
  });
  const fm = await page.evaluate(() => document.body.innerText);
  ok("file mode badge shows file quota (5 of 5)", fm.includes("5 of 5"), "file requests left today");
  ok("file mode notice mentions OpenRouter", fm.includes("File task") && fm.includes("OpenRouter"));

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => /Gemma|Inkling|Nemotron|Free Router/.test(x.textContent) && x.closest(".relative")
    );
    b?.click();
  });
  // header is text-transform:uppercase, so innerText comes back uppercased
  await page.waitForFunction(
    () => document.body.innerText.includes("FILE TASK — MODELS THAT SUPPORT FILES"),
    { timeout: 5000 }
  );
  const fmMenu = await page.evaluate(() => document.body.innerText);
  ok(
    "file dropdown lists OpenRouter file models",
    fmMenu.includes("Gemma 4 31B") && fmMenu.includes("Inkling") && fmMenu.includes("OpenRouter")
  );
  ok("file dropdown hides Nara text models", !fmMenu.includes("Agnes 2.5 Flash"));
  await shot(page, "feat-7-file-models.png");
  await page.mouse.click(700, 100);
  await sleep(300);

  // per-user file limit: 5/day
  sql(
    `INSERT INTO provider_usage (user_id, provider, day, count) VALUES ('${USER}','openrouter','${TODAY}',5) ON CONFLICT(user_id, provider, day) DO UPDATE SET count = 5;`
  );
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
  await attachFile();
  await page.waitForFunction(() => document.body.innerText.includes("File limit reached"), {
    timeout: 15000,
  });
  ok("file badge shows 5/day limit reached", true);
  await shot(page, "feat-8-file-limit-badge.png");
  await page.type('textarea[placeholder*="Message SK-AI"]', "should be file-blocked");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.innerText.includes("File-task limit reached"), {
    timeout: 20000,
  });
  ok("file send blocked at 5/day (server-enforced)", true);
  await shot(page, "feat-9-file-limit-error.png");

  // global OpenRouter quota: 50/day blocks ALL file requests
  sql(
    `INSERT INTO provider_usage (user_id, provider, day, count) VALUES ('__global__','openrouter','${TODAY}',50) ON CONFLICT(user_id, provider, day) DO UPDATE SET count = 50;`
  );
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder*="Message SK-AI"]', { timeout: 15000 });
  await attachFile();
  await page.waitForFunction(() => document.body.innerText.includes("OpenRouter quota reached"), {
    timeout: 15000,
  });
  ok("badge shows OpenRouter quota exhausted", true);
  await page.type('textarea[placeholder*="Message SK-AI"]', "global block test");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.innerText.includes("OpenRouter's daily quota"), {
    timeout: 20000,
  });
  const gq = await page.evaluate(() => document.body.innerText);
  ok("global quota blocks all OpenRouter requests", gq.includes("Text chat via NaraRouter still works"));
  await shot(page, "feat-10-global-quota.png");

  // NaraRouter text chat keeps working while OpenRouter is blocked
  // (nara usage is at 25 from the earlier seed → nara limit error, proving the nara path)
  await page.type('textarea[placeholder*="Message SK-AI"]', "text while openrouter blocked");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.innerText.includes("messages per day per user"), {
    timeout: 20000,
  });
  const afterText = await page.evaluate(() => document.body.innerText);
  ok(
    "nara text path unaffected by OpenRouter block",
    !afterText.includes("OpenRouter's daily quota")
  );
  await shot(page, "feat-11-text-still-works.png");
} catch (e) {
  ok("script completed without exception", false, String(e).slice(0, 300));
} finally {
  await close();
  clearUser(USER);
  sql(`DELETE FROM provider_usage WHERE user_id='__global__';`);
  const passed = finish();
  process.exit(passed ? 0 : 1);
}
