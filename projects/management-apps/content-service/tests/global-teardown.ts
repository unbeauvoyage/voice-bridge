import { rmSync } from "node:fs";
import type { FullConfig } from "@playwright/test";

export default function globalTeardown(config: FullConfig): void {
  const contentDir = config.metadata["contentDir"];
  if (typeof contentDir === "string" && contentDir.startsWith("/tmp/playwright-content-service-")) {
    rmSync(contentDir, { recursive: true, force: true });
  }
}
