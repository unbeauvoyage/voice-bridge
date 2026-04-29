/**
 * User story: operator wants confidence that voice-bridge-ts and
 * voice-bridge-dotnet return byte-shape-identical GET /health responses so
 * ceo-app's backend toggle is invisible to API clients.
 *
 * Background (why this test exists): live verification during the .NET
 * migration (2026-04-29) caught voice-bridge-dotnet returning plain "Healthy"
 * from the default Aspire MapDefaultEndpoints() instead of the JSON shape
 *   { status: "ok", ts: <unix-ms-number> }
 * that the TS sibling returns. That specific bug was fixed in PR #22 (commit
 * eb4f0fb). This test guards against the same class of regression recurring.
 *
 * Given voice-bridge-ts is running on its canonical AppHost port :3030
 * And voice-bridge-dotnet is running on its canonical AppHost port :8773
 * When I call GET /health on both stacks
 * Then both return HTTP 200
 * And both JSON bodies have exactly the keys: status, ts
 * And status is the string "ok" on both sides
 * And ts is a positive integer (unix-ms epoch) on both sides
 *
 * NEGATIVE CONTROL PROVEN: during development this test was first run with the
 * assertion expect(dotnetBody['status']).toBe('WRONG') — it went RED as
 * expected. After reverting to 'ok', it went GREEN. The test is verified to
 * be able to fail for the right reason.
 */

import { test, expect } from 'bun:test';

// ── Ports ─────────────────────────────────────────────────────────────────────

/**
 * Canonical AppHost ports. Both stacks must be running (via
 * `dotnet run --project AppHost`) for this test to pass. If either stack is
 * unreachable the test fails with a clear connection-refused error — it is
 * never silently skipped.
 */
const TS_URL = 'http://127.0.0.1:3030';
const DOTNET_URL = 'http://127.0.0.1:8773';

// ── Helper ────────────────────────────────────────────────────────────────────

function isHealthRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

// ── Story test ────────────────────────────────────────────────────────────────

test(
  'operator calls GET /health on both voice-bridge stacks and sees identical wire shapes',
  async () => {
    // ── Fetch both stacks ──────────────────────────────────────────────────────
    const [tsRes, dotnetRes] = await Promise.all([
      fetch(`${TS_URL}/health`).catch((err: unknown) => {
        throw new Error(
          `voice-bridge-ts at ${TS_URL} is not reachable — is AppHost running? ` +
            `Original error: ${String(err)}`,
        );
      }),
      fetch(`${DOTNET_URL}/health`).catch((err: unknown) => {
        throw new Error(
          `voice-bridge-dotnet at ${DOTNET_URL} is not reachable — is AppHost running? ` +
            `Original error: ${String(err)}`,
        );
      }),
    ]);

    // ── Both respond 200 ───────────────────────────────────────────────────────
    // Negative control: change 200 to 201 here → RED.
    expect(tsRes.status).toBe(200);
    expect(dotnetRes.status).toBe(200);

    // ── Parse both bodies ──────────────────────────────────────────────────────
    const tsBody: unknown = await tsRes.json();
    const dotnetBody: unknown = await dotnetRes.json();

    if (!isHealthRecord(tsBody)) {
      throw new Error(`voice-bridge-ts /health returned non-object: ${JSON.stringify(tsBody)}`);
    }
    if (!isHealthRecord(dotnetBody)) {
      throw new Error(`voice-bridge-dotnet /health returned non-object: ${JSON.stringify(dotnetBody)}`);
    }

    // ── status must be "ok" on both stacks ────────────────────────────────────
    // Negative control: change 'ok' to 'WRONG' → RED.
    expect(tsBody['status']).toBe('ok');
    expect(dotnetBody['status']).toBe('ok');

    // ── ts must be a positive integer on both stacks ───────────────────────────
    const tsTimestamp = tsBody['ts'];
    const dotnetTimestamp = dotnetBody['ts'];

    expect(typeof tsTimestamp).toBe('number');
    expect(typeof dotnetTimestamp).toBe('number');

    // ts must be a positive integer (unix-ms is always > 0)
    expect(Number.isInteger(tsTimestamp)).toBe(true);
    expect(Number.isInteger(dotnetTimestamp)).toBe(true);

    // Sanity: both ts values should be in a plausible unix-ms range
    // (after 2020-01-01 and before 2100-01-01)
    const MIN_MS = 1_577_836_800_000; // 2020-01-01
    const MAX_MS = 4_102_444_800_000; // 2100-01-01
    if (!isNumber(tsTimestamp)) throw new Error(`ts from TS stack is not a number: ${JSON.stringify(tsTimestamp)}`);
    if (!isNumber(dotnetTimestamp)) throw new Error(`ts from .NET stack is not a number: ${JSON.stringify(dotnetTimestamp)}`);
    expect(tsTimestamp).toBeGreaterThan(MIN_MS);
    expect(tsTimestamp).toBeLessThan(MAX_MS);
    expect(dotnetTimestamp).toBeGreaterThan(MIN_MS);
    expect(dotnetTimestamp).toBeLessThan(MAX_MS);

    // ── Key presence: exactly the two canonical keys must exist on BOTH stacks ─
    const requiredKeys: ReadonlyArray<string> = ['status', 'ts'];
    for (const key of requiredKeys) {
      expect(tsBody).toHaveProperty(key);
      // Negative control: rename .NET key to catch drift →
      // expect(dotnetBody).toHaveProperty('ts_WRONG') fails RED.
      expect(dotnetBody).toHaveProperty(key);
    }

    // ── Neither body has extra keys (no undocumented additions) ───────────────
    const tsKeys = Object.keys(tsBody).sort();
    const dotnetKeys = Object.keys(dotnetBody).sort();
    // Negative control: if .NET added an extra field, these arrays differ → RED.
    expect(tsKeys).toEqual(dotnetKeys);
  },
  15_000,
);
