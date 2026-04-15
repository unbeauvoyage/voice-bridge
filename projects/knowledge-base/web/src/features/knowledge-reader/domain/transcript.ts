// ── Transcript helpers ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const TIMESTAMP_RE = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/g;

export function formatTranscript(raw: string): string[] {
  if (/\n\n/.test(raw)) {
    return raw.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  }
  const sentences = raw.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const paragraphs: string[] = [];
  let current: string[] = [];
  let wordCount = 0;
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    current.push(sentence.trim());
    wordCount += words;
    if (wordCount >= 200) {
      paragraphs.push(current.join(' '));
      current = [];
      wordCount = 0;
    }
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs.filter(Boolean);
}

export function buildTranscriptHtml(raw: string, searchQuery: string, activeMatchIdx: number): string {
  const paragraphs = formatTranscript(raw);
  const parts = paragraphs.map((para) => {
    let rendered = '';
    let lastIndex = 0;
    TIMESTAMP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIMESTAMP_RE.exec(para)) !== null) {
      rendered += escapeHtml(para.slice(lastIndex, m.index));
      rendered += `<span class="timestamp-chip">${escapeHtml(m[1] ?? '')}</span>`;
      lastIndex = m.index + m[0].length;
    }
    rendered += escapeHtml(para.slice(lastIndex));
    return `<p>${rendered}</p>`;
  });
  let html = parts.join('');
  if (searchQuery) {
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let matchCount = 0;
    html = html.replace(new RegExp(`(${escaped})(?=[^<]*(?:<|$))`, 'gi'), (_full, word) => {
      const cls = matchCount === activeMatchIdx ? 'transcript-highlight active' : 'transcript-highlight';
      matchCount++;
      return `<mark class="${cls}">${word}</mark>`;
    });
  }
  return html;
}

export function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(escaped, 'gi')) ?? []).length;
}

export const TRANSCRIPT_COLLAPSE_LIMIT = 3000;
export const TRANSCRIPT_PREVIEW_LENGTH = 1500;
