/**
 * Shared validation-error response shape used by every route that parses a
 * request body at the boundary.
 *
 * Rationale: Stage-4 codex review flagged that the server silently accepted
 * malformed/hostile payloads (prototype-pollution in /mic, arbitrary keys
 * in /settings). Routes now parse with Zod at the boundary and emit this
 * consistent 400 shape so the client only has to handle one error contract.
 */

import { z } from 'zod'

type Issue = z.core.$ZodIssue

export type ValidationErrorBody = {
  error: 'validation_failed'
  details: Array<{ path: string; message: string }>
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

function issueToDetail(issue: Issue): { path: string; message: string } {
  const path = issue.path.map((p) => String(p)).join('.') || '(body)'
  return { path, message: issue.message }
}

export function validationError(issues: Issue[]): Response {
  const body: ValidationErrorBody = {
    error: 'validation_failed',
    details: issues.map(issueToDetail)
  }
  return Response.json(body, { status: 400, headers: CORS_HEADERS })
}

/**
 * Parse text as JSON and validate against a Zod schema. Returns a 400
 * validation-error Response on any failure (parse error OR schema mismatch)
 * and a `{ ok: true, data }` discriminated-union on success.
 */
export function parseJsonBody<T>(
  text: string,
  schema: z.ZodType<T>
): { ok: true; data: T } | { ok: false; response: Response } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    const jsonIssue: Issue = {
      code: 'custom',
      path: [],
      message: 'request body is not valid JSON',
      input: text
    }
    return { ok: false, response: validationError([jsonIssue]) }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return { ok: false, response: validationError(result.error.issues) }
  }
  return { ok: true, data: result.data }
}
