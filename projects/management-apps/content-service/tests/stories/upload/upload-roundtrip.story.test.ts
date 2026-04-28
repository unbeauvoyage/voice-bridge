import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8771";

// Minimal valid 1x1 red PNG (63 bytes) — generated offline, stable fixture
const PNG_HEX =
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de" +
  "000000064944415463f8cfc00000795317b80000000049454e44ae426082";
const PNG_BYTES = Buffer.from(PNG_HEX, "hex");
const PNG_SHA256 = "c19b45b1a6e247471ea82b674f5eb58e52d7bb71ffcf2403030b88e1322cfafc";

async function uploadPng(bytes = PNG_BYTES): Promise<globalThis.Response> {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), "test.png");
  return fetch(`${BASE}/upload`, { method: "POST", body: form });
}

function contentDirFromConfig(metadata: Record<string, unknown>): string {
  const dir = metadata["contentDir"];
  if (typeof dir !== "string") {
    throw new Error("contentDir not set in playwright.config.ts metadata");
  }
  return dir;
}

// ─── Story 1: Upload round-trip and content-addressed dedup ─────────────────

test("user uploads a PNG, retrieves the exact same bytes, and re-uploading the same file returns the same id with only one file on disk", async () => {
  // Given the content-service is running at BASE
  // When I POST a PNG as multipart/form-data to /upload
  // Then I receive a 200 with a content-hashed upload result
  // And GET <url> returns the identical bytes
  // And uploading the same bytes again returns the same id (dedup)
  // And only one file exists on disk for that sha256

  const uploadRes = await uploadPng();
  expect(uploadRes.status).toBe(200);

  const body: Record<string, unknown> = await uploadRes.json();

  expect(typeof body["id"]).toBe("string");
  expect(typeof body["url"]).toBe("string");
  expect(typeof body["mime"]).toBe("string");
  expect(typeof body["bytes"]).toBe("number");
  expect(typeof body["sha256"]).toBe("string");

  expect(body["mime"]).toBe("image/png");
  expect(body["bytes"]).toBeGreaterThan(0);
  expect(body["id"]).toMatch(/^[0-9a-f]{64}$/);
  expect(body["sha256"]).toMatch(/^[0-9a-f]{64}$/);
  expect(body["id"]).toBe(body["sha256"]);
  expect(body["sha256"]).toBe(PNG_SHA256);

  const url = body["url"];
  if (typeof url !== "string") throw new Error(`expected url string, got ${typeof url}`);
  expect(url).toMatch(/^http:\/\//);
  expect(url).toContain("/files/");

  // GET the returned url — verify byte-for-byte match
  const getRes = await fetch(url);
  expect(getRes.status).toBe(200);
  expect(getRes.headers.get("content-type")).toBe("image/png");

  const returnedBytes = Buffer.from(await getRes.arrayBuffer());
  expect(returnedBytes.length).toBe(PNG_BYTES.length);
  expect(returnedBytes.toString("hex")).toBe(PNG_HEX);

  // Upload the same bytes again — must return the same id (content-addressed dedup)
  const dupRes = await uploadPng();
  expect(dupRes.status).toBe(200);
  const dupBody: Record<string, unknown> = await dupRes.json();
  expect(dupBody["id"]).toBe(body["id"]);
  expect(dupBody["sha256"]).toBe(body["sha256"]);

  // Filesystem: exactly one file for this sha256
  const contentDir = contentDirFromConfig(test.info().config.metadata);
  const files = readdirSync(contentDir).filter((f) => f.startsWith(PNG_SHA256));
  expect(files.length).toBe(1);

  // NEGATIVE CONTROL: upload different bytes → different id
  const altBytes = Buffer.concat([PNG_BYTES, Buffer.from([0x00])]);
  const altRes = await uploadPng(altBytes);
  expect(altRes.status).toBe(200);
  const altBody: Record<string, unknown> = await altRes.json();
  expect(altBody["id"]).not.toBe(body["id"]);

  // NEGATIVE CONTROL: tamper the url → must 404
  const badUrl = url.replace(/[0-9a-f]{64}/, "a".repeat(64));
  const badRes = await fetch(badUrl);
  expect(badRes.status).toBe(404);

  // Revert: confirm the real url still 200s
  const recheck = await fetch(url);
  expect(recheck.status).toBe(200);
});

// ─── Story 2: Non-existent file returns 404 ──────────────────────────────────

test("requesting a file that does not exist returns 404 with error not_found", async () => {
  // Given a well-formed but non-existent 64-char hex id
  // When I GET /files/<id>.png
  // Then I get 404 and { error: "not_found" }

  const ghostId = "0".repeat(64);
  const res = await fetch(`${BASE}/files/${ghostId}.png`);
  expect(res.status).toBe(404);

  const body: Record<string, unknown> = await res.json();
  expect(body["error"]).toBe("not_found");

  // NEGATIVE CONTROL: assert 200 → must fail
  let caught = false;
  try {
    expect(res.status).toBe(200);
  } catch {
    caught = true;
  }
  expect(caught).toBe(true);
});
