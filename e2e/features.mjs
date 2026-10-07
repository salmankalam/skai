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
const { ok, finish } = createResults();

await waitForDevServer();
clearUser(USER);

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

  const now = Date.now();
  let seed = `INSERT INTO conversations (id, user_id, title, model, created_at, updated_at) VALUES ('e2e-limit-conv','${USER}','Limit test','google/gemma-4-31b-it:free',${now},${now});`;
  for (let i = 0; i < 25; i++) {
    seed += `INSERT INTO messages (id, conversation_id, role, content, attachments, timestamp) VALUES ('e2e-msg-${i}','e2e-limit-conv','user','seed ${i}',NULL,${now});`;
  }
  sql(seed);

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
      (x) => /Gemma|Nemotron|Free Router|Inkling|North/.test(x.textContent) && x.closest(".relative")
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
} catch (e) {
  ok("script completed without exception", false, String(e).slice(0, 300));
} finally {
  await close();
  clearUser(USER);
  const passed = finish();
  process.exit(passed ? 0 : 1);
}
