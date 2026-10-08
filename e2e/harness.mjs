import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

export const REPO = path.resolve(import.meta.dirname, "..");
export const SHOTS = path.join(REPO, "e2e", "screenshots");
export const BASE = "http://localhost:5173";

const EDGE_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

export const EDGE = EDGE_CANDIDATES.find((p) => fs.existsSync(p));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createResults() {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
  };
  const finish = () => {
    const failed = results.filter((r) => !r.pass);
    console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} passed ===`);
    return failed.length === 0;
  };
  return { ok, finish };
}

export async function shot(page, file) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, file) });
  console.log(`shot: e2e/screenshots/${file}`);
}

export function sql(command) {
  return execSync(`npx wrangler d1 execute sk-ai-db --local --command "${command}"`, {
    cwd: REPO,
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 60000,
  });
}

export function clearUser(userId) {
  sql(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id='${userId}'); DELETE FROM files WHERE user_id='${userId}'; DELETE FROM conversations WHERE user_id='${userId}'; DELETE FROM provider_usage WHERE user_id='${userId}';`);
}

export async function waitForDevServer() {
  for (let i = 0; i < 15; i++) {
    const up = await new Promise((resolve) => {
      http
        .get(BASE, (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        })
        .on("error", () => resolve(false));
    });
    if (up) return;
    await sleep(500);
  }
  console.error(`Dev server not reachable at ${BASE}. Start it first: npm run dev`);
  process.exit(1);
}

export async function launchBrowser(port) {
  if (!EDGE) {
    console.error("Microsoft Edge not found");
    process.exit(1);
  }
  const profile = fs.mkdtempSync(path.join(REPO, "e2e", ".profile-"));
  const child = spawn(
    EDGE,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 40; i++) {
    const alive = await new Promise((resolve) => {
      http
        .get(`http://127.0.0.1:${port}/json/version`, (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        })
        .on("error", () => resolve(false));
    });
    if (alive) break;
    await sleep(500);
  }
  const version = await new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/json/version`, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      })
      .on("error", reject);
  });
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl });
  return {
    browser,
    close: async () => {
      await browser.close().catch(() => {});
      child.kill();
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}
