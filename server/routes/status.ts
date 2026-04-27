/**
 * GET /status — returns { target, micState }
 *
 * Session snapshot: the last-used relay target and the current microphone state.
 * Pure read-only handler; no request body is inspected so the Request object
 * is not needed.
 */

export type StatusContext = {
  loadLastTarget: () => string
  isMicOn: () => boolean
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

export function handleStatus(ctx: StatusContext): Response {
  return Response.json(
    { target: ctx.loadLastTarget(), micState: ctx.isMicOn() ? 'on' : 'off' },
    { headers: CORS_HEADERS }
  )
}
