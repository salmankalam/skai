import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1400, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
