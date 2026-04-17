/**
 * Request parsing concern for POST /transcribe.
 *
 * Extracted from transcribe.ts — handles the body-draining, form-parsing,
 * and field-validation stages before Whisper is invoked. No I/O beyond
 * reading the request body.
 *
 * Three-layer body size defense:
 *   1. Bun.serve maxRequestBodySize (set in server/index.ts) — parser-level cap.
 *   2. Content-Length preflight — cheap, rejects oversized honest-CL bodies.
 *   3. Streaming accounting — counts bytes as chunks arrive; Bun's maxRequestBodySize
 *      does NOT fire for Transfer-Encoding: chunked bodies (verified on Bun 1.3.3).
 */

// Body size: 10 MiB absolute cap at the HTTP boundary. A 60s voice message
// at webm/opus ~32kbps is ~240 KiB, so this is ~40× typical.
const MAX_BODY_BYTES = 10 * 1024 * 1024
// Audio file cap — slightly tighter than body so non-audio form overhead cannot push us past the body limit.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
// MIME allowlist. Anything else (including octet-stream, text/*) is 415.
const ALLOWED_AUDIO_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/x-aac',
  'audio/flac',
  'audio/m4a',
  'audio/x-m4a',
  // Chrome MediaRecorder produces video/webm even for audio-only recordings.
  // Whisper handles webm containers fine regardless of the container/codec label.
  'video/webm'
])
// Reasonable cap for a routing target name. Longer strings are almost certainly hostile.
const MAX_TO_LEN = 128

/**
 * The parsed, validated fields extracted from a POST /transcribe multipart body.
 */
export interface ParsedTranscribeRequest {
  audioFile: File
  audioBuffer: Buffer
  audioMime: string
  explicitTo: string
  transcribeOnly: boolean
}

/**
 * Result of parseTranscribeRequest.
 * - ok: validation passed; `parsed` contains the extracted fields
 * - error: validation failed; `response` is ready to return to the client
 */
export type ParseTranscribeResult =
  | { kind: 'ok'; parsed: ParsedTranscribeRequest }
  | { kind: 'error'; status: number; response: Response }

/**
 * Parses and validates a POST /transcribe multipart request.
 *
 * Returns { kind: 'ok', parsed } on success or { kind: 'error', status, response }
 * on any validation failure. All error responses include CORS headers.
 */
export async function parseTranscribeRequest(req: Request): Promise<ParseTranscribeResult> {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

  // ── Layer 2: Content-Length preflight ─────────────────────────────────────
  const contentLengthHeader = req.headers.get('content-length')
  if (contentLengthHeader !== null) {
    const declared = Number(contentLengthHeader)
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return {
        kind: 'error',
        status: 413,
        response: Response.json(
          { error: 'Request body too large' },
          { status: 413, headers: corsHeaders }
        )
      }
    }
  }

  // ── Layer 3: Streaming accounting + form parse ────────────────────────────
  let formData: FormData
  if (req.body) {
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const reader = req.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > MAX_BODY_BYTES) {
          // Fire-and-forget cancel: hostile clients may return a never-resolving promise.
          void reader.cancel().catch(() => {})
          return {
            kind: 'error',
            status: 413,
            response: Response.json(
              { error: 'Request body too large' },
              { status: 413, headers: corsHeaders }
            )
          }
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    try {
      const bodyBuf = Buffer.concat(chunks)
      const parseReq = new Response(bodyBuf, { headers: req.headers })
      formData = await parseReq.formData()
    } catch {
      return {
        kind: 'error',
        status: 400,
        response: Response.json(
          { error: 'Invalid form data' },
          { status: 400, headers: corsHeaders }
        )
      }
    }
  } else {
    try {
      formData = await req.formData()
    } catch {
      return {
        kind: 'error',
        status: 400,
        response: Response.json(
          { error: 'Invalid form data' },
          { status: 400, headers: corsHeaders }
        )
      }
    }
  }

  // ── Extract and validate form fields ──────────────────────────────────────
  const toField = formData.get('to')
  const explicitTo = typeof toField === 'string' ? toField.trim() : ''
  if (explicitTo.length > MAX_TO_LEN) {
    return {
      kind: 'error',
      status: 400,
      response: Response.json(
        { error: `\`to\` field exceeds ${MAX_TO_LEN} chars` },
        { status: 400, headers: corsHeaders }
      )
    }
  }

  const audioFile = formData.get('audio')
  if (!audioFile || !(audioFile instanceof File)) {
    return {
      kind: 'error',
      status: 400,
      response: Response.json(
        { error: 'Missing audio field' },
        { status: 400, headers: corsHeaders }
      )
    }
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return {
      kind: 'error',
      status: 413,
      response: Response.json(
        { error: 'Audio file too large' },
        { status: 413, headers: corsHeaders }
      )
    }
  }

  // Require an explicit allowed MIME — blank MIME used to fall through via || 'audio/webm',
  // which let a File with type='' reach ffmpeg/Whisper and fail as 500.
  const audioMime = audioFile.type
  if (!audioMime || !ALLOWED_AUDIO_MIME.has(audioMime)) {
    return {
      kind: 'error',
      status: 415,
      response: Response.json(
        { error: `Unsupported audio MIME: ${audioMime || '(blank)'}` },
        { status: 415, headers: corsHeaders }
      )
    }
  }

  const transcribeOnly = formData.get('transcribe_only') === '1'
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer())

  return {
    kind: 'ok',
    parsed: {
      audioFile,
      audioBuffer,
      audioMime,
      explicitTo,
      transcribeOnly
    }
  }
}
