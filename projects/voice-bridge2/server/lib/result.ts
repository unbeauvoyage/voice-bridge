/**
 * Minimal Result type for functions that perform I/O.
 *
 * Per server-standards.md: never return void from a function that can fail —
 * return Result<void>. Never console.error + return undefined — propagate up.
 *
 * Usage:
 *   function doThing(): Promise<Result<string>> {
 *     try {
 *       return { ok: true, data: await fetch(...) }
 *     } catch (err) {
 *       return { ok: false, error: String(err) }
 *     }
 *   }
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
