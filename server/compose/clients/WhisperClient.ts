/**
 * WhisperClient — interface + HTTP implementation.
 *
 * Calls whisper-server /inference endpoint, encapsulated behind an interface
 * for portability + dependency injection.
 *
 * Used exclusively by the compose orchestrator.
 */

import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Interface ──────────────────────────────────────────────────────────────────

export interface WhisperTranscribeResult {
  transcript: string
}

export interface IWhisperClient {
  /**
   * Transcribe raw audio bytes.
   * Throws on network failure or non-2xx from whisper-server.
   * Returns empty string if whisper detects no speech (not an error).
   */
  transcribe(audioBuffer: Buffer, mime: string): Promise<WhisperTranscribeResult>
}

// ── HTTP implementation ────────────────────────────────────────────────────────

const CRLF = '\r\n'

/** Returns the file extension (without leading dot) for the given MIME type. */
function mimeToExt(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'mp4'
  if (mime.includes('m4a')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

/** Returns true if the audio is already a WAV file and ffmpeg conversion can be skipped. */
function isAlreadyWav(mime: string): boolean {
  return mime.includes('wav')
}

function buildWhisperBody(wavBuffer: Buffer, boundary: string): Buffer {
  const filePart =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="recording.wav"${CRLF}` +
    `Content-Type: audio/wav${CRLF}${CRLF}`

  const textField = (name: string, value: string): string =>
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
    value

  return Buffer.concat([
    Buffer.from(filePart),
    wavBuffer,
    Buffer.from(textField('response_format', 'text')),
    Buffer.from(textField('language', 'auto')),
    Buffer.from(textField('no_context', '1')),
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
  ])
}

const TMP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../tmp')
mkdirSync(TMP_DIR, { recursive: true })

function convertToWav(audioBuffer: Buffer, ext: string): Buffer {
  const id = randomUUID()
  const inputPath = join(TMP_DIR, `compose-${id}.${ext}`)
  const wavPath = join(TMP_DIR, `compose-${id}.wav`)
  try {
    writeFileSync(inputPath, audioBuffer)
    execFileSync(
      'ffmpeg',
      ['-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath, '-y'],
      { timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    return readFileSync(wavPath)
  } finally {
    try {
      unlinkSync(inputPath)
    } catch {
      /* tmp cleanup — ignore */
    }
    try {
      unlinkSync(wavPath)
    } catch {
      /* tmp cleanup — ignore */
    }
  }
}

export class HttpWhisperClient implements IWhisperClient {
  private readonly url: string
  private readonly timeoutMs: number

  constructor(url: string, timeoutMs = 120_000) {
    this.url = url
    this.timeoutMs = timeoutMs
  }

  async transcribe(audioBuffer: Buffer, mime: string): Promise<WhisperTranscribeResult> {
    const ext = mimeToExt(mime)
    // WHISPER_SKIP_CONVERT=1: bypass ffmpeg for test environments.
    // Also skip conversion if the audio is already a WAV (ffmpeg would error on same-format in-place).
    const skipConvert = process.env['WHISPER_SKIP_CONVERT'] === '1' || isAlreadyWav(mime)
    const wavBuffer = skipConvert ? audioBuffer : convertToWav(audioBuffer, ext)

    const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`
    const bodyBuf = buildWhisperBody(wavBuffer, boundary)
    const bodyBuffer = new ArrayBuffer(bodyBuf.byteLength)
    new Uint8Array(bodyBuffer).set(bodyBuf)

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: bodyBuffer,
      signal: AbortSignal.timeout(this.timeoutMs)
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Whisper service error ${response.status}: ${detail.slice(0, 200)}`)
    }

    const text = await response.text()
    return { transcript: text.trim() }
  }
}
