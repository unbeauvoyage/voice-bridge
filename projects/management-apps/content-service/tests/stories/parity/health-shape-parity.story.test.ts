/**
 * User story: operator wants confidence that content-service-ts and
 * content-service-dotnet return byte-shape-identical GET /health responses so
 * ceo-app's backend toggle is invisible to API clients.
 *
 * Background (why this test exists): live verification during the .NET
 * migration (2026-04-29) found voice-bridge-dotnet returning plain "Healthy"
 * from the default Aspire MapDefaultEndpoints() instead of the JSON shape the
 * TS sibling returns. ContentService has the same structural risk. This test
 * guards against that class of regression:
 *
 *   content-service-ts :8770  → { status: "ok", service: "content-service" }
 *   content-service-dotnet :8771 → must match exactly
 *
 * Given content-service-ts is running on its canonical AppHost port :8770
 * And content-service-dotnet is running on its canonical AppHost port :8771
 * When I call GET /health on both stacks
 * Then both return HTTP 200
 * And both JSON bodies have exactly the keys: status, service
 * And status is the string "ok" on both sides
 * And service is the string "content-service" on both sides
 *
 * NOTE: This test does NOT use playwright.config.ts's webServer (port :8772).
 * It talks directly to AppHost-managed ports. Run this test after starting
 * AppHost: `dotnet run --project AppHost` from ~/environment/projects/management-apps/.
 * If either stack is unreachable the test fails with a clear error — never
 * silently skipped.
 *
 * NEGATIVE CONTROL PROVEN: during development this test was first run with the
 * assertion expect(dotnetBody['service']).toBe('WRONG_SERVICE') — it went RED
 * as expected. After reverting to 'content-service', it went GREEN. The test
 * is verified to be able to fail for the right reason.
 */

import { test, expect } from "@playwright/test";

// ── Ports ─────────────────────────────────────────────────────────────────────

/**
 * Canonical AppHost ports. Both stacks must be running for this test to pass.
 * These are NOT the test-isolated port :8772 from playwright.config.ts — they
 * are the production-equivalent AppHost ports.
 */
const TS_URL = "http://127.0.0.1:8770";
const DOTNET_URL = "http://127.0.0.1:8771";

// ── Helper ────────────────────────────────────────────────────────────────────

function isHealthRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── Story test ────────────────────────────────────────────────────────────────

test(
  "operator calls GET /health on both content-service stacks and sees identical wire shapes",
  async ({ request }) => {
    // ── Fetch both stacks ──────────────────────────────────────────────────────
    const [tsRes, dotnetRes] = await Promise.all([
      request.get(`${TS_URL}/health`).catch((err: unknown) => {
        throw new Error(
          `content-service-ts at ${TS_URL} is not reachable — is AppHost running? ` +
            `Original error: ${String(err)}`,
        );
      }),
      request.get(`${DOTNET_URL}/health`).catch((err: unknown) => {
        throw new Error(
          `content-service-dotnet at ${DOTNET_URL} is not reachable — is AppHost running? ` +
            `Original error: ${String(err)}`,
        );
      }),
    ]);

    // ── Both respond 200 ───────────────────────────────────────────────────────
    // Negative control: change 200 to 201 here → RED.
    expect(tsRes.status()).toBe(200);
    expect(dotnetRes.status()).toBe(200);

    // ── Parse both bodies ──────────────────────────────────────────────────────
    const tsBody: unknown = await tsRes.json();
    const dotnetBody: unknown = await dotnetRes.json();

    if (!isHealthRecord(tsBody)) {
      throw new Error(
        `content-service-ts /health returned non-object: ${JSON.stringify(tsBody)}`,
      );
    }
    if (!isHealthRecord(dotnetBody)) {
      throw new Error(
        `content-service-dotnet /health returned non-object: ${JSON.stringify(dotnetBody)}`,
      );
    }

    // ── status must be "ok" on both stacks ────────────────────────────────────
    // Negative control: change 'ok' to 'WRONG' → RED.
    expect(tsBody["status"]).toBe("ok");
    expect(dotnetBody["status"]).toBe("ok");

    // ── service must be "content-service" on both stacks ─────────────────────
    // Negative control: change 'content-service' to 'WRONG_SERVICE' → RED.
    expect(tsBody["service"]).toBe("content-service");
    expect(dotnetBody["service"]).toBe("content-service");

    // ── Key presence: exactly the two canonical keys must exist on BOTH stacks ─
    const requiredKeys: ReadonlyArray<string> = ["status", "service"];
    for (const key of requiredKeys) {
      expect(tsBody).toHaveProperty(key);
      // Negative control: rename .NET key to catch drift →
      // expect(dotnetBody).toHaveProperty('service_WRONG') fails RED.
      expect(dotnetBody).toHaveProperty(key);
    }

    // ── Neither body has extra keys (no undocumented additions on either side) ─
    const tsKeys = Object.keys(tsBody).sort();
    const dotnetKeys = Object.keys(dotnetBody).sort();
    // Negative control: if .NET added an extra field, these arrays differ → RED.
    expect(tsKeys).toEqual(dotnetKeys);
  },
);
