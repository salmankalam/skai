import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
  server: {
    watch: {
      // Don't watch e2e browser profiles (Edge writes HTML files there mid-test,
      // which otherwise triggers full page reloads) or log files.
      ignored: ["**/node_modules/**", "**/.git/**", "**/e2e/**", "**/*.log", "**/.wrangler/**"],
    },
  },
});
