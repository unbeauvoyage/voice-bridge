/**
 * "Meta" routes — the trivial liveness + static UI endpoints that are too
 * small to each warrant their own file.
 *
 *   GET /health — { status: "ok", ts: <ms-epoch> }  (no CORS, matches original)
 *   GET /       — serves the mobile recording UI HTML, 404 if missing
 */

export function handleHealth(): Response {
  return Response.json({ status: 'ok', ts: Date.now() })
}

export type IndexHtmlContext = {
  /** Load the index.html bytes. Return null if the file is missing. Throws are caught. */
  loadIndexHtml: () => Promise<string | Uint8Array | null>
}

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' } as const

export async function handleIndexHtml(ctx: IndexHtmlContext): Promise<Response> {
  try {
    const html = await ctx.loadIndexHtml()
    if (html === null) return new Response('Not found', { status: 404 })
    return new Response(html, { headers: HTML_HEADERS })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
