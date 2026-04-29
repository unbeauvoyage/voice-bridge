import "./otel";

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Fastify from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import {
  ensureStorageRoot,
  storeFile,
  loadFile,
  ALLOWED_MIMES,
  MAX_BYTES,
} from "./storage";

const HOST = process.env["HOST"] ?? "127.0.0.1";
const PORT = Number(process.env["PORT"] ?? "8770");
const OPENAPI_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "openapi.yaml",
);

await ensureStorageRoot();

const app = Fastify({
  logger: { level: process.env["LOG_LEVEL"] ?? "info" },
  bodyLimit: MAX_BYTES + 1024,
});

await app.register(cors, { 
  origin: ['http://localhost:5175', 'http://127.0.0.1:5175'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
});

// Add Vary header to all responses for cache correctness
app.addHook('onSend', async (_req, reply) => {
  reply.header('Vary', 'Origin');
});
await app.register(multipart, {
  limits: { fileSize: MAX_BYTES, files: 1 },
});

app.get("/health", async () => ({ status: "ok", service: "content-service" }));

app.get("/version", async () => ({ name: "content-service", version: "0.1.0" }));

app.get("/openapi.yaml", async (_req, reply) => {
  const yaml = await readFile(OPENAPI_PATH, "utf8");
  await reply.header("Content-Type", "application/yaml; charset=utf-8").send(yaml);
});

app.post("/upload", async (req, reply) => {
  const part = await req.file();
  if (part === undefined) {
    await reply.code(400).send({ error: "no_file", message: "expected multipart 'file' field" });
    return;
  }
  const mime = part.mimetype;
  if (!ALLOWED_MIMES.includes(mime)) {
    await reply.code(415).send({
      error: "unsupported_media_type",
      message: `mime ${mime} not allowed`,
      allowed: ALLOWED_MIMES,
    });
    return;
  }
  const buffer = await part.toBuffer();
  if (part.file.truncated) {
    await reply.code(413).send({ error: "too_large", maxBytes: MAX_BYTES });
    return;
  }
  if (buffer.length === 0) {
    await reply.code(400).send({ error: "empty_file" });
    return;
  }
  const stored = await storeFile(buffer, mime);
  const url = absoluteUrl(req, `/files/${stored.id}${stored.ext}`);
  await reply.send({
    id: stored.id,
    url,
    mime: stored.mime,
    bytes: stored.bytes,
    sha256: stored.sha256,
  });
});

app.get<{ Params: { idWithExt: string } }>(
  "/files/:idWithExt",
  async (req, reply) => {
    const { idWithExt } = req.params;
    const file = await loadFile(idWithExt);
    if (file === null) {
      await reply.code(404).send({ error: "not_found" });
      return;
    }
    await reply
      .header("Content-Type", file.mime)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(file.buffer);
  },
);

function absoluteUrl(
  req: { protocol: string; host: string; headers: Record<string, string | string[] | undefined> },
  pathname: string,
): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = typeof forwardedProto === "string" ? forwardedProto : req.protocol;
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = req.headers["host"];
  const host = typeof forwardedHost === "string"
    ? forwardedHost
    : typeof hostHeader === "string"
      ? hostHeader
      : req.host;
  return `${proto}://${host}${pathname}`;
}

await app.listen({ host: HOST, port: PORT });
app.log.info({ host: HOST, port: PORT }, "content-service listening");
