import { test as base } from "@playwright/test";

/**
 * Extends the base Playwright test with a `contentDir` fixture that exposes
 * the isolated storage directory the webServer is running with.
 *
 * The content-service process is spawned by playwright.config.ts webServer —
 * this fixture only surfaces the path for assertions (e.g. file-count checks).
 * It does NOT import from content-service src.
 */
export const test = base.extend<{ contentDir: string }>({
  contentDir: async ({ }, use) => {
    const dir = test.info().config.metadata["contentDir"];
    if (typeof dir !== "string") {
      throw new Error("contentDir not set in playwright.config.ts metadata");
    }
    await use(dir);
  },
});

export { expect } from "@playwright/test";
