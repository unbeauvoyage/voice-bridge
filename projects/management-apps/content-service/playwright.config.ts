import { defineConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";

const contentDir = `/tmp/playwright-content-service-${process.pid}`;
mkdirSync(contentDir, { recursive: true });

export default defineConfig({
  testMatch: ["**/*.story.test.ts", "**/*.story.ts"],
  use: {
    baseURL: "http://127.0.0.1:8771",
  },
  webServer: {
    command: "bun run src/index.ts",
    url: "http://127.0.0.1:8771/health",
    reuseExistingServer: false,
    timeout: 10_000,
    env: {
      PORT: "8771",
      HOST: "127.0.0.1",
      CONTENT_DIR: contentDir,
      LOG_LEVEL: "warn",
    },
  },
  globalTeardown: "./tests/global-teardown.ts",
  metadata: { contentDir },
});
