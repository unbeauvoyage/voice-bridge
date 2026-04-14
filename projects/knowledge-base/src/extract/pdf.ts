export async function extractPdf(url: string): Promise<{
  title: string;
  content: string;
  author?: string;
  extractionError?: string;
}> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return { title: url, content: '', extractionError: `HTTP ${res.status}` };

  const buffer = await res.arrayBuffer();

  const ts = Date.now();
  const tmpIn = `/tmp/kb-pdf-${ts}.pdf`;
  const tmpOut = `/tmp/kb-pdf-${ts}.txt`;
  await Bun.write(tmpIn, buffer);

  try {
    await Bun.$`pdftotext ${tmpIn} ${tmpOut}`.quiet();
    const text = await Bun.file(tmpOut).text();
    const lines = text.split('\n').filter((l) => l.trim());
    const title = lines[0]?.slice(0, 100) || url.split('/').pop() || 'PDF Document';
    return { title, content: text.slice(0, 50000) };
  } catch {
    return {
      title: url.split('/').pop() || 'PDF',
      content: '',
      extractionError: 'pdftotext not available — install poppler-utils',
    };
  } finally {
    try { await Bun.$`rm -f ${tmpIn} ${tmpOut}`.quiet(); } catch {}
  }
}

export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf');
}
