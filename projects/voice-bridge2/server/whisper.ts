/**
 * Whisper transcription via local whisper-server (whisper.cpp).
 * Runs under pm2 on port 8766, model loaded in memory.
 * Converts audio to 16kHz mono WAV via ffmpeg before sending.
 * POST multipart → http://127.0.0.1:8766/inference
 */

import { randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const WHISPER_URL = process.env.WHISPER_URL ?? 'http://127.0.0.1:8766/inference'
const WHISPER_TIMEOUT_MS = 120_000 // 2 min — medium model on CPU can take 60-90s for longer messages
const TMP_DIR = join(import.meta.dir, '..', 'tmp')
mkdirSync(TMP_DIR, { recursive: true })

function convertToWav(audioBuffer: Buffer, ext: string): Buffer {
  const id = randomUUID()
  const inputPath = join(TMP_DIR, `${id}.${ext}`)
  const wavPath = join(TMP_DIR, `${id}.wav`)
  try {
    writeFileSync(inputPath, audioBuffer)
    console.log(`[whisper] input: ${audioBuffer.length} bytes (${ext})`)
    const ffOut = execSync(
      `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y 2>&1`,
      { timeout: 60000 }
    )
    console.log(
      `[whisper] ffmpeg: ${ffOut
        .toString()
        .split('\n')
        .filter((l) => l.includes('Duration') || l.includes('Output'))
        .join(' | ')}`
    )
    const wav = readFileSync(wavPath)
    const wavSamples = (wav.length - 44) / 2 // 16-bit samples
    console.log(
      `[whisper] wav: ${wav.length} bytes, ${wavSamples} samples, ${(wavSamples / 16000).toFixed(1)}s`
    )
    return wav
  } finally {
    try {
      unlinkSync(inputPath)
    } catch {
      /* tmp file may already be gone */
    }
    try {
      unlinkSync(wavPath)
    } catch {
      /* tmp file may already be gone */
    }
  }
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeTypeToExt(mimeType)
  // WHISPER_SKIP_CONVERT=1 bypasses ffmpeg — for test environments with fake audio bytes
  const wavBuffer =
    process.env.WHISPER_SKIP_CONVERT === '1' ? audioBuffer : convertToWav(audioBuffer, ext)

  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`
  const CRLF = '\r\n'

  const filePart =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="recording.wav"${CRLF}` +
    `Content-Type: audio/wav${CRLF}${CRLF}`

  const textField = (name: string, value: string): string =>
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
    value

  const body = Buffer.concat([
    Buffer.from(filePart),
    wavBuffer,
    Buffer.from(textField('response_format', 'text')),
    Buffer.from(textField('language', 'auto')),
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
  ])

  const response = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body,
    signal: AbortSignal.timeout(WHISPER_TIMEOUT_MS)
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Whisper service error ${response.status}: ${detail.slice(0, 200)}`)
  }

  const text = await response.text()
  return text.trim()
}

function mimeTypeToExt(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'mp4'
  if (mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}
