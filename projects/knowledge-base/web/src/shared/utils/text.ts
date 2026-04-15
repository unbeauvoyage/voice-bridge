// ── Text helpers ──────────────────────────────────────────────────────────────

export function readingStats(text: string | undefined): { wordCount: number; minutes: number } | null {
  if (!text) return null;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return null;
  const minutes = Math.ceil(wordCount / 200);
  return { wordCount, minutes };
}
