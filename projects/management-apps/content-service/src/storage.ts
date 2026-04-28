import { createHash } from "node:crypto";
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, extname } from "node:path";

const STORAGE_ROOT =
  process.env["CONTENT_DIR"] !== undefined && process.env["CONTENT_DIR"].length > 0
    ? process.env["CONTENT_DIR"]
    : join(homedir(), ".claude", "content");

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const ALLOWED_MIMES = Object.keys(MIME_EXT);
export const MAX_BYTES = 25 * 1024 * 1024;

export interface StoredFile {
  id: string;
  sha256: string;
  mime: string;
  bytes: number;
  ext: string;
  path: string;
}

export async function ensureStorageRoot(): Promise<void> {
  if (!existsSync(STORAGE_ROOT)) {
    await mkdir(STORAGE_ROOT, { recursive: true });
  }
}

export async function storeFile(
  buffer: Buffer,
  mime: string,
): Promise<StoredFile> {
  const ext = MIME_EXT[mime];
  if (ext === undefined) {
    throw new Error(`unsupported mime: ${mime}`);
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const id = sha256;
  const filename = `${id}${ext}`;
  const path = join(STORAGE_ROOT, filename);
  if (!existsSync(path)) {
    await writeFile(path, buffer);
  }
  return { id, sha256, mime, bytes: buffer.length, ext, path };
}

export async function loadFile(
  idWithExt: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const ext = extname(idWithExt);
  const id = idWithExt.slice(0, idWithExt.length - ext.length);
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const mime = Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0];
  if (mime === undefined) return null;
  const path = join(STORAGE_ROOT, idWithExt);
  if (!existsSync(path)) return null;
  const fileStat = await stat(path);
  if (!fileStat.isFile()) return null;
  const buffer = await readFile(path);
  return { buffer, mime };
}
