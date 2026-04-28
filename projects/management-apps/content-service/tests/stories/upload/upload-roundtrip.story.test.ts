import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";

// Minimal valid 1x1 red PNG (63 bytes) — generated offline, stable fixture
const PNG_HEX =
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de" +
  "000000064944415463f8cfc00000795317b80000000049454e44ae426082";
const PNG_BYTES = Buffer.from(PNG_HEX, "hex");
const PNG_SHA256 = "c19b45b1a6e247471ea82b674f5eb58e52d7bb71ffcf2403030b88e1322cfafc";

async function uploadPng(bytes = PNG_BYTES): Promise<globalThis.Response> {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), "test.png");
  return fetch("http://127.0.0.1:8771/upload", { method: "POST", body: form });
}

function contentDirFromConfig(metadata: Record<string, unknown>): string {
  const dir = metadata["contentDir"];
  if (typeof dir !== "string") {
    throw new Error("contentDir not set in playwright.config.ts metadata");
  }
  return dir;
}

// ─── Test 1: Happy-path round-trip ──────────────────────────────────────────

test("user uploads a PNG and retrieves the exact same bytes via the returned URL", async () => {
  // Given the content-service is running at port 8771
  // When I POST a PNG as multipart/form-data to /upload
  // Then I receive a 200 with a content-hashed upload result
  // And GET <url> returns the identical bytes

  const uploadRes = await uploadPng();
  expect(uploadRes.status).toBe(200);

  const body = await uploadRes.json() as Record<string, unknown>;

  // Shape assertions against OpenAPI UploadResult schema
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

  const url = body["url"] as string;
  expect(url).toMatch(/^http:\/\//);
  expect(url).toContain("/files/");

  // GET the returned url — verify byte-for-byte match
  const getRes = await fetch(url);
  expect(getRes.status).toBe(200);
  expect(getRes.headers.get("content-type")).toBe("image/png");

  const returnedBytes = Buffer.from(await getRes.arrayBuffer());
  expect(returnedBytes.length).toBe(PNG_BYTES.length);
  expect(returnedBytes.toString("hex")).toBe(PNG_HEX);

  // NEGATIVE CONTROL: tamper the url → must 404
  const badUrl = url.replace(/[0-9a-f]{64}/, "a".repeat(64));
  const badRes = await fetch(badUrl);
  expect(badRes.status).toBe(404);

  // Revert: confirm the real url still 200s
  const recheck = await fetch(url);
  expect(recheck.status).toBe(200);
});

// ─── Test 2: Content-addressed dedup ────────────────────────────────────────

test("uploading the same PNG twice returns the same id and stores only one file", async () => {
  // Given two uploads of identical bytes
  // When both complete
  // Then both responses have the same id and sha256
  // And only one file exists on disk

  const [res1, res2] = await Promise.all([uploadPng(), uploadPng()]);
  expect(res1.status).toBe(200);
  expect(res2.status).toBe(200);

  const body1 = await res1.json() as Record<string, unknown>;
  const body2 = await res2.json() as Record<string, unknown>;

  expect(body1["id"]).toBe(body2["id"]);
  expect(body1["sha256"]).toBe(body2["sha256"]);

  // Both GET calls return the same bytes
  const [get1, get2] = await Promise.all([
    fetch(body1["url"] as string),
    fetch(body2["url"] as string),
  ]);
  const [bytes1, bytes2] = await Promise.all([get1.arrayBuffer(), get2.arrayBuffer()]);
  expect(Buffer.from(bytes1).toString("hex")).toBe(Buffer.from(bytes2).toString("hex"));

  // Filesystem: exactly one file for this sha256
  const contentDir = contentDirFromConfig(test.info().config.metadata);
  const files = readdirSync(contentDir).filter((f) => f.startsWith(PNG_SHA256));
  expect(files.length).toBe(1);

  // NEGATIVE CONTROL: upload different bytes → different id
  const altBytes = Buffer.concat([PNG_BYTES, Buffer.from([0x00])]);
  const altRes = await uploadPng(altBytes);
  const altBody = await altRes.json() as Record<string, unknown>;
  expect(altBody["id"]).not.toBe(body1["id"]);
});

// ─── Test 3: Non-existent ID 404 ────────────────────────────────────────────

test("requesting a file that does not exist returns 404 with error not_found", async () => {
  // Given a well-formed but non-existent 64-char hex id
  // When I GET /files/<id>.png
  // Then I get 404 and { error: "not_found" }

  const ghostId = "0".repeat(64);
  const res = await fetch(`http://127.0.0.1:8771/files/${ghostId}.png`);
  expect(res.status).toBe(404);

  const body = await res.json() as Record<string, unknown>;
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

// ─── Test 4: Health endpoint ─────────────────────────────────────────────────

test("health endpoint returns { status: ok, service: content-service }", async () => {
  // Given the service is up
  // When I GET /health
  // Then I receive { status: "ok", service: "content-service" }

  const res = await fetch("http://127.0.0.1:8771/health");
  expect(res.status).toBe(200);

  const body = await res.json() as Record<string, unknown>;
  expect(body["status"]).toBe("ok");
  expect(body["service"]).toBe("content-service");

  // NEGATIVE CONTROL: assert wrong value → must fail
  let caught = false;
  try {
    expect(body["status"]).toBe("not_ok");
  } catch {
    caught = true;
  }
  expect(caught).toBe(true);
});

// ─── Test 5: OpenAPI endpoint ────────────────────────────────────────────────

test("OpenAPI spec endpoint returns YAML starting with openapi: 3.", async () => {
  // Given the service is up
  // When I GET /openapi.yaml
  // Then I receive application/yaml with a valid OpenAPI 3.x header

  const res = await fetch("http://127.0.0.1:8771/openapi.yaml");
  expect(res.status).toBe(200);

  const contentType = res.headers.get("content-type") ?? "";
  expect(contentType.toLowerCase()).toContain("yaml");

  const text = await res.text();
  expect(text.trimStart()).toMatch(/^openapi: 3\./);

  // NEGATIVE CONTROL: assert wrong version prefix → must fail
  let caught = false;
  try {
    expect(text.trimStart()).toMatch(/^openapi: 2\./);
  } catch {
    caught = true;
  }
  expect(caught).toBe(true);
});
