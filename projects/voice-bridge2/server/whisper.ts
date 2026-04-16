/**
 * Whisper transcription via local whisper-server (whisper.cpp).
 * Runs under pm2 on port 8766, model loaded in memory.
 * Converts audio to 16kHz mono WAV via ffmpeg before sending.
 * POST multipart → http://127.0.0.1:8766/inference
 */

import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { WHISPER_BASE_URL_DEFAULT, WHISPER_TIMEOUT_MS } from './config.ts'

const WHISPER_URL = process.env.WHISPER_URL ?? WHISPER_BASE_URL_DEFAULT
// WHISPER_TIMEOUT_MS: 2 min — medium model on CPU can take 60-90s for longer messages
const TMP_DIR = join(import.meta.dir, '..', 'tmp')
mkdirSync(TMP_DIR, { recursive: true })

function convertToWav(audioBuffer: Buffer, ext: string): Buffer {
  const id = randomUUID()
  const inputPath = join(TMP_DIR, `${id}.${ext}`)
  const wavPath = join(TMP_DIR, `${id}.wav`)
  try {
    writeFileSync(inputPath, audioBuffer)
    console.log(`[whisper] input: ${audioBuffer.length} bytes (${ext})`)
    const ffOut = execFileSync(
      'ffmpeg',
      ['-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath, '-y'],
      { timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }
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

/**
 * Compute RMS from a pcm_s16le WAV buffer.
 *
 * Scans for the RIFF 'data' subchunk by searching for the ASCII bytes 'd','a','t','a'
 * starting after the fmt chunk (byte 12). This handles WAV files with extra chunks
 * (LIST, INFO, etc.) between fmt and data — rather than assuming a fixed 44-byte offset.
 *
 * Returns 0 if no data chunk is found or the buffer is too small.
 */
export function computeWavRms(wav: Buffer): number {
  // Minimum valid WAV: 'RIFF' + 4-byte size + 'WAVE' + 'fmt ' chunk (minimum 24 bytes) = at least 44 bytes
  if (wav.length < 44) return 0

  // Search for 'data' subchunk starting after RIFF header (byte 12)
  // Each chunk has: 4-byte ID + 4-byte size + data
  let offset = 12
  let dataOffset = -1
  let dataSize = 0

  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const chunkSize = wav.readUInt32LE(offset + 4)
    if (id === 'data') {
      dataOffset = offset + 8
      dataSize = chunkSize
      break
    }
    // Advance past this chunk (header + data, padded to even byte boundary)
    const advance = 8 + chunkSize + (chunkSize % 2)
    if (advance <= 0) break // guard against malformed chunk sizes
    offset += advance
  }

  if (dataOffset < 0 || dataSize === 0) return 0

  const numSamples = Math.floor(Math.min(dataSize, wav.length - dataOffset) / 2)
  if (numSamples === 0) return 0

  let sumSq = 0
  for (let i = 0; i < numSamples; i++) {
    const s = wav.readInt16LE(dataOffset + i * 2)
    sumSq += s * s
  }
  return Math.sqrt(sumSq / numSamples)
}

export interface TranscribeResult {
  transcript: string
  /** RMS of the ffmpeg-converted pcm_s16le buffer, on the 0–32767 int16 scale. */
  audioRms: number
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscribeResult> {
  const ext = mimeTypeToExt(mimeType)
  // WHISPER_SKIP_CONVERT=1 bypasses ffmpeg — for test environments with fake audio bytes.
  // In this mode, treat the buffer as-is and compute RMS over it (assumed WAV in tests).
  const wavBuffer =
    process.env.WHISPER_SKIP_CONVERT === '1' ? audioBuffer : convertToWav(audioBuffer, ext)

  // Compute RMS from the converted pcm_s16le WAV — this is the ground truth signal
  // level, regardless of the original upload format (webm, ogg, mp4, etc.).
  const audioRms = computeWavRms(wavBuffer)

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
  return { transcript: text.trim(), audioRms }
}

export function mimeTypeToExt(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'mp4'
  if (mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}
