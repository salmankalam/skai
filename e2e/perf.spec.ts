import { test } from "@playwright/test";

test("perf snapshot", async ({ page }) => {
  test.skip(!process.env.PROD_SMOKE, "set PROD_SMOKE=1 to hit the live deployment");
  const url = "https://sk-ai.salmankalam123.workers.dev";
  const nav = await page.goto(url, { waitUntil: "networkidle" });
  const timing = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const res = performance.getEntriesByType("resource").map((r) => ({
      name: r.name.split("/").pop()!.split("?")[0],
      kb: Math.round((r as PerformanceResourceTiming).transferSize / 1024),
      ms: Math.round(r.duration),
    }));
    return {
      ttfb: Math.round(n.responseStart - n.requestStart),
      dcl: Math.round(n.domContentLoadedEventEnd - n.startTime),
      load: Math.round(n.loadEventEnd - n.startTime),
      res,
    };
  });
  const totalKb = timing.res.reduce((s, r) => s + r.kb, 0);
  console.log(`TTFB ${timing.ttfb}ms · DCL ${timing.dcl}ms · load ${timing.load}ms · transfer ${totalKb}KB`);
  for (const r of [...timing.res].sort((a, b) => b.kb - a.kb).slice(0, 8)) {
    console.log(`  ${r.kb}KB ${r.ms}ms ${r.name}`);
  }

  // cache check: second load of an asset URL
  const asset = timing.res.find((r) => r.name.endsWith(".js"));
  if (asset) {
    const abs = `${url}/assets/${asset.name}`;
    const h1 = await page.request.get(abs);
    const cc = h1.headers()["cache-control"] ?? "(none)";
    const enc = h1.headers()["content-encoding"] ?? "(identity)";
    console.log(`asset ${asset.name}: cache-control=${cc} encoding=${enc} size=${h1.headers()["content-length"]}B`);
  }
  // second navigation: are assets served from browser cache?
  await page.reload({ waitUntil: "networkidle" });
  const cached = await page.evaluate(() =>
    performance.getEntriesByType("resource").filter((r) => (r as PerformanceResourceTiming).transferSize === 0).length
  );
  const count = await page.evaluate(() => performance.getEntriesByType("resource").length);
  console.log(`reload: ${cached}/${count} resources from cache`);
});
