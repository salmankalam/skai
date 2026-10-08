// Temporary: probe Nara free-model streaming health. Usage: node scripts/probe-nara.mjs
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const vars = {};
for (const line of fs.readFileSync(path.join(REPO, ".dev.vars"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) vars[m[1]] = m[2].trim();
}

const IDS = process.argv.slice(2);

async function probe(id, attempt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch("https://router.bynara.id/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vars.NARA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: id,
        stream: true,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 100,
      }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      return { id, attempt, status: res.status, outcome: "HTTP_ERROR", detail: t.slice(0, 120) };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let errorEvent = null;
    let frames = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      frames++;
      if (chunk.includes("event: error") || /"error"\s*:/.test(chunk)) {
        errorEvent = chunk.replace(/\s+/g, " ").slice(0, 180);
      }
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === "string") text += delta;
        } catch {}
      }
      if (text.length > 60) break;
    }
    clearTimeout(timer);
    const outcome = text.trim() ? "OK" : errorEvent ? "STREAM_ERROR" : "EMPTY";
    return { id, attempt, status: res.status, outcome, detail: text.trim() ? text.trim().slice(0, 60) : errorEvent ?? `frames=${frames}` };
  } catch (e) {
    clearTimeout(timer);
    return { id, attempt, status: "-", outcome: "TIMEOUT/NET", detail: String(e).slice(0, 120) };
  }
}

for (const id of IDS) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await probe(id, attempt);
    console.log(`${r.id} #${r.attempt} -> ${r.status} ${r.outcome} :: ${r.detail}`);
  }
}
