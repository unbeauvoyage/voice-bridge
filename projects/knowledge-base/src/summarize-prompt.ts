// Pure prompt template builders for summarization.
//
// The template is the reusable instruction — no per-item content. Storing
// the template (instead of template+content) lets summary_prompt_templates track
// prompt evolution across many items rather than growing a new row per call.

export interface SummaryPromptSettings {
  lang: string;
  keepTerms: boolean;
  detail: string;
  hasKnownDate: boolean;
  tagGuidance: string;
}

export function buildSummaryPromptTemplate(s: SummaryPromptSettings): string {
  const languageInstruction = s.lang === 'english' ? `LANGUAGE RULES:
- Always write the ENTIRE summary, TL;DR, and all section points in English, regardless of the source language.
- If the source content is in a non-English language, translate all content to English.
${s.keepTerms ? `- When domain-specific terms in the original language carry important nuance or are widely used in that field/region (e.g. Japanese business terms, technical vocabulary, cultural concepts), keep the original term in parentheses immediately after its English translation. Example: "used bicycle market (中古自転車市場)" or "agency fee (仲介手数料)". This helps the reader recognize the specific term if they encounter it in the wild. Use judgment — only for terms with genuine nuance, not every word.` : ''}

` : '';

  const detailRules =
    s.detail === 'brief'
      ? `- summary: Write a brief summary (2-3 sentences max).
- tldr: 2 bullet points only. Each a single punchy sentence.
- sections: none — omit the sections array (return []).`
      : s.detail === 'detailed'
      ? `- summary: Write a comprehensive summary (8-12 sentences). Cover all major points in depth.
- tldr: 5-6 key points, each a complete informative sentence capturing the author's core arguments.
- sections: Include detailed sections covering all major topics. Aim for 5-10 sections, each with 4-10 points.`
      : `- summary: 5-7 sentence overview of the entire content.
- tldr: 3-4 bullet points, each a single punchy sentence. Capture the core message.
- sections: Aim for 3-5 sections, each with 3-6 points.`;

  const jsonSchema = s.hasKnownDate
    ? `{
  "tldr": [
    "One-liner that captures the core message of the whole piece",
    "Second key takeaway the author wants you to leave with",
    "Third essential point"
  ],
  "summary": "Overview of the entire content",
  "sections": [
    {
      "title": "Section Title",
      "points": ["detailed point 1", "detailed point 2", "..."]
    }
  ],
  "tags": ["tag1", "tag2", "tag3"]
}`
    : `{
  "tldr": [
    "One-liner that captures the core message of the whole piece",
    "Second key takeaway the author wants you to leave with",
    "Third essential point"
  ],
  "summary": "Overview of the entire content",
  "sections": [
    {
      "title": "Section Title",
      "points": ["detailed point 1", "detailed point 2", "..."]
    }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "publishedAt": "YYYY-MM-DD or null"
}`;

  const publishedAtRule = s.hasKnownDate
    ? ''
    : `- publishedAt: Extract the original publication or upload date of this content. Look for: article publish date, YouTube upload date, "Published on", byline dates, copyright year, or any date mentioned at the top of the content. Return in YYYY-MM-DD format. If you cannot determine the date, return null.\n`;

  return `${languageInstruction}You are a teacher explaining this content to a curious student who hasn't seen it. Your job is not to summarize — it is to teach. Structure your explanation so the student walks away understanding exactly what the author covered, in the order and structure the author intended. Respond with ONLY valid JSON in this exact format:
${jsonSchema}

Rules:
${detailRules}
- Each tldr point should capture what the author is fundamentally trying to say — not just facts, but the insight. Write from a teaching perspective: "The key idea is...", "What makes this significant is...", etc.
- Each section point should be a complete, informative sentence that teaches the idea — not just names it.
- If the content is an enumerated list (e.g. "10 features", "5 tips", "top N things"), preserve every item in the author's exact order and numbering: "1. Name — what it does/means". Do not collapse or reorder.
- Use the author's own section titles and structure when they exist. Mirror their organization.
- Generate 3-6 tags ordered from most general to most specific. Prefer specific useful tags (e.g. "LLM Fine-Tuning") over vague ones (e.g. "AI").
- Tags must use Title Case with spaces: "Unreal Engine", "Game Development", "Machine Learning". Acronyms stay uppercase: "AI", "LLM", "VR", "API".
- Reuse preferred tags wherever they apply. Only create new tags when none of the preferred ones fit.
${publishedAtRule}${s.tagGuidance}`;
}

export function buildSummaryLLMInput(template: string, content: string): string {
  return `${template}

Content:
${content}`;
}
