// Verifies the free model lists against the live provider catalogs.
// Usage: npm run models:check   (requires keys in .dev.vars)
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");

function readDevVars() {
  const file = path.join(REPO, ".dev.vars");
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function parseModelIds() {
  const src = fs.readFileSync(path.join(REPO, "src", "lib", "models.ts"), "utf8");
  const entries = [];
  const re = /\{\s*id:\s*"([^"]+)"[^{}]*?route:\s*"(nara|openrouter)"/g;
  let m;
  while ((m = re.exec(src))) entries.push({ id: m[1], route: m[2] });
  return entries;
}

async function fetchJson(url, key) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const vars = readDevVars();
const models = parseModelIds();
let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};
const pass = (msg) => console.log(`PASS ${msg}`);

console.log(`Checking ${models.length} configured models...\n`);

const nara = models.filter((m) => m.route === "nara");
const openrouter = models.filter((m) => m.route === "openrouter");

if (vars.NARA_API_KEY) {
  const data = await fetchJson("https://router.bynara.id/v1/models", vars.NARA_API_KEY);
  const live = new Set((data.data ?? []).map((m) => m.id));
  for (const m of nara) {
    if (live.has(m.id)) pass(`nara: ${m.id}`);
    else fail(`nara: ${m.id} NOT in GET /v1/models`);
  }
  const unknown = [...live].filter((id) => !nara.some((m) => m.id === id));
  if (unknown.length) console.log(`\n  Other Nara ids (review for free tier):\n    ${unknown.join("\n    ")}`);
} else {
  console.log("SKIP nara: NARA_API_KEY not set");
}

if (vars.OPENROUTER_API_KEY) {
  const data = await fetchJson("https://openrouter.ai/api/v1/models", vars.OPENROUTER_API_KEY);
  const byId = new Map((data.data ?? []).map((m) => [m.id, m]));
  for (const m of openrouter) {
    const entry = byId.get(m.id);
    if (!entry) {
      fail(`openrouter: ${m.id} NOT in GET /v1/models`);
      continue;
    }
    const promptPrice = entry?.pricing?.prompt;
    if (Number(promptPrice) === 0) pass(`openrouter: ${m.id} (free)`);
    else fail(`openrouter: ${m.id} PAID (pricing.prompt=${promptPrice})`);
  }
} else {
  console.log("SKIP openrouter: OPENROUTER_API_KEY not set");
}

console.log(failed ? `\n${failed} problem(s) found.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
