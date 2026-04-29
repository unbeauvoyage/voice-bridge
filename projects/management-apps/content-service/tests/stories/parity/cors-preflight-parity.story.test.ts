/**
 * Story: ceo-app browser preflight is accepted by BOTH content-service stacks
 *
 * CORS regression guard. When ceo-app (served at http://localhost:5175) calls
 * POST /upload cross-origin, the browser fires an OPTIONS preflight before the
 * real request. Without a correct CORS policy the preflight fails and the user
 * sees "Failed to fetch" — breaking the backend toggle and clipboard-image upload.
 *
 * PARITY NOTE (discovered 2026-04-29 during test-authoring):
 *   The TS content-service (src/index.ts) registers @fastify/cors with
 *   `origin: true, credentials: false`. This means:
 *     - It reflects ANY request origin back (not just the whitelist) — gap.
 *     - It does NOT set Access-Control-Allow-Credentials: true — gap if ceo-app
 *       ever needs credentialed cross-origin requests to content-service.
 *   The .NET service correctly uses the BackendDefaults whitelist with credentials.
 *   Tracked in handoffs/cors-drift-2026-04-29-all-services.md.
 *
 * Given:
 *   - TS content-service is running at http://127.0.0.1:8770 (AppHost-managed)
 *   - .NET content-service is running at http://127.0.0.1:8771 (AppHost-managed)
 * When:
 *   - Browser sends OPTIONS preflight with Origin: http://localhost:5175
 *   - Same preflight from Origin: http://evil.example.com (negative control)
 * Then:
 *   - Both stacks return 204 for the ceo-app origin
 *   - .NET stack includes Access-Control-Allow-Origin: http://localhost:5175 + credentials
 *   - .NET stack blocks evil origin (no Allow-Origin header)
 *
 * NEGATIVE CONTROL PROVEN: The assertion `expect(dotnetRes.status()).toBe(999)`
 * was tried first — it went RED (expected 999, received 204). Reverted to 204
 * → GREEN. Assertions are live.
 *
 * NOTE: Like health-shape-parity.story.test.ts, this test talks directly to
 * AppHost-managed ports, NOT the playwright.config.ts test-isolated :8772.
 * Run after starting AppHost: `dotnet run --project AppHost`.
 */

import { test, expect } from "@playwright/test";

const TS_URL = "http://127.0.0.1:8770";
const DOTNET_URL = "http://127.0.0.1:8771";
const CEO_APP_ORIGIN = "http://localhost:5175";
const EVIL_ORIGIN = "http://evil.example.com";

// ── Precondition check ──────────────────────────────────────────────────────

test("precondition: both content-service stacks are up before CORS assertions run", async ({
  request,
}) => {
  const [tsRes, dotnetRes] = await Promise.all([
    request.get(`${TS_URL}/health`).catch((err: unknown) => {
      throw new Error(
        `content-service-ts at ${TS_URL} is not reachable — is AppHost running? Original error: ${String(err)}`,
      );
    }),
    request.get(`${DOTNET_URL}/health`).catch((err: unknown) => {
      throw new Error(
        `content-service-dotnet at ${DOTNET_URL} is not reachable — is AppHost running? Original error: ${String(err)}`,
      );
    }),
  ]);
  // Negative control: change 200 to 201 → RED.
  expect(tsRes.status()).toBe(200);
  expect(dotnetRes.status()).toBe(200);
});

// ── .NET content-service — correct whitelist behaviour ──────────────────────

test(".NET content-service preflight from ceo-app origin returns 204 with correct CORS headers", async ({
  request,
}) => {
  // Given .NET content-service is running
  // When ceo-app browser sends OPTIONS preflight to POST /upload
  const res = await request.fetch(`${DOTNET_URL}/upload`, {
    method: "OPTIONS",
    headers: {
      Origin: CEO_APP_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,traceparent",
    },
  });

  // Then preflight succeeds
  // Negative control: change 204 to 999 → RED.
  expect(res.status()).toBe(204);

  // And the allow-origin echoes ceo-app exactly (not wildcard)
  // Negative control: change CEO_APP_ORIGIN to 'http://wrong.example.com' → RED.
  expect(res.headers()["access-control-allow-origin"]).toBe(CEO_APP_ORIGIN);

  // And credentials are allowed
  expect(res.headers()["access-control-allow-credentials"]).toBe("true");

  // And POST is listed
  const allowMethods = res.headers()["access-control-allow-methods"] ?? "";
  expect(allowMethods.toUpperCase()).toContain("POST");

  // And content-type header is allowed
  const allowHeaders = res.headers()["access-control-allow-headers"] ?? "";
  expect(allowHeaders.toLowerCase()).toContain("content-type");
});

test(".NET content-service preflight from untrusted origin is rejected — no Allow-Origin header returned", async ({
  request,
}) => {
  // Given .NET content-service enforces an origin whitelist
  // When an evil origin sends a preflight
  const res = await request.fetch(`${DOTNET_URL}/upload`, {
    method: "OPTIONS",
    headers: {
      Origin: EVIL_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  // Then the browser will block the real request
  // Negative control: assert allowOrigin equals EVIL_ORIGIN → RED (it's null/absent).
  const allowOrigin = res.headers()["access-control-allow-origin"];
  expect(allowOrigin).not.toBe(EVIL_ORIGIN);
  expect(allowOrigin).not.toBe("*");
});

// ── TS content-service — functional parity for allowed origin, known gap for evil origin ─

test("TS content-service preflight from ceo-app origin returns 204 with correct origin reflected", async ({
  request,
}) => {
  // Given TS content-service is running
  // When ceo-app browser sends OPTIONS preflight to POST /upload
  const res = await request.fetch(`${TS_URL}/upload`, {
    method: "OPTIONS",
    headers: {
      Origin: CEO_APP_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,traceparent",
    },
  });

  // Preflight succeeds (TS reflects the requested origin, so ceo-app origin works)
  expect(res.status()).toBe(204);

  // TS content-service reflects back the requested origin correctly for ceo-app
  expect(res.headers()["access-control-allow-origin"]).toBe(CEO_APP_ORIGIN);

  // NOTE: TS content-service does NOT return Access-Control-Allow-Credentials.
  // The .NET counterpart does. This is drift — if ceo-app needs credentialed
  // upload requests, the TS side will fail in browsers. Tracked for fix.
  const allowMethods = res.headers()["access-control-allow-methods"] ?? "";
  expect(allowMethods.toUpperCase()).toContain("POST");
});

test("KNOWN DRIFT: TS content-service reflects evil origin back (see cors-drift handoff)", async ({
  request,
}) => {
  // This test documents the known security gap in the TS content-service CORS policy.
  // src/index.ts registers `@fastify/cors` with `origin: true` — reflects any origin.
  // Fix: change to `origin: ['http://localhost:5175', 'http://127.0.0.1:5175']`.
  // Tracked in handoffs/cors-drift-2026-04-29-all-services.md.
  const res = await request.fetch(`${TS_URL}/upload`, {
    method: "OPTIONS",
    headers: {
      Origin: EVIL_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  const allowOrigin = res.headers()["access-control-allow-origin"];
  // Document current (broken) behavior: TS reflects evil origin back.
  // After fix: allowOrigin should be undefined/null for evil origins.
  expect(allowOrigin).toBe(EVIL_ORIGIN); // ← WRONG behavior, tracked for fix
});
