import type { ExtractedContent, KnowledgeSection } from './types.ts';
import { getSetting, getTagRules, upsertPromptTemplate } from './db.ts';
import { buildSummaryPromptTemplate, buildSummaryLLMInput } from './summarize-prompt.ts';
import { llmComplete } from './llm.ts';

interface SummarizeResult {
  tldr: string[];
  summary: string;
  sections: KnowledgeSection[];
  tags: string[];
  publishedAt?: string;
  model: string;
  promptId: number;
}

const MAX_CONTENT_CHARS = 12000;

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return text.slice(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated for summarization]';
}

export async function llmQuery(prompt: string): Promise<string> {
  const { content } = await llmComplete([{ role: 'user', content: prompt }]);
  return content;
}

export async function llmChat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]): Promise<string> {
  const { content } = await llmComplete(messages);
  return content;
}

export async function summarize(
  extracted: ExtractedContent,
  approvedTags: string[] = [],
  rejectedTags: string[] = [],
  knownPublishedAt?: string,
): Promise<SummarizeResult> {
  const tagGuidance = [
    approvedTags.length
      ? `Preferred existing tags (reuse these when they fit — ordered general to specific): ${approvedTags.join(', ')}`
      : '',
    rejectedTags.length
      ? `Never use these tags (rejected): ${rejectedTags.join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const lang = getSetting('summary_language') ?? 'english';
  const keepTerms = getSetting('translate_terms') === 'true';
  const detail = getSetting('summary_detail') ?? 'standard';

  const hasKnownDate = typeof knownPublishedAt === 'string' && knownPublishedAt.length > 0;

  // Store the reusable template (no content) in summary_prompt_templates so we
  // track prompt evolution, not per-item data. The LLM still receives
  // template + content combined.
  const template = buildSummaryPromptTemplate({ lang, keepTerms, detail, hasKnownDate, tagGuidance });
  const promptId = upsertPromptTemplate('summary_prompt_templates', template);

  const llmInput = buildSummaryLLMInput(template, truncate(extracted.content));
  const { content: text, model: usedModel } = await llmComplete([{ role: 'user', content: llmInput }]);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    process.stderr.write(`[summarize] ERROR: No JSON found in LLM response (first 200 chars): ${text.slice(0, 200)}\n`);
    throw new Error('No JSON found in LLM response');
  }

  let parsed: object;
  try {
    const rawParsed: unknown = JSON.parse(jsonMatch[0]);
    if (typeof rawParsed !== 'object' || rawParsed === null || Array.isArray(rawParsed)) {
      throw new Error('LLM response JSON is not an object');
    }
    parsed = rawParsed;
  } catch {
    process.stderr.write(`[summarize] ERROR: Failed to parse JSON from LLM response: ${jsonMatch[0].slice(0, 200)}\n`);
    throw new Error('Failed to parse JSON from LLM response');
  }

  function getField(obj: object, key: string): unknown {
    return Object.hasOwn(obj, key) ? Reflect.get(obj, key) : undefined;
  }

  const rawPublishedAt = getField(parsed, 'publishedAt');
  const llmPublishedAt = typeof rawPublishedAt === 'string' && rawPublishedAt !== 'null' ? rawPublishedAt : undefined;
  const publishedAt = knownPublishedAt ?? llmPublishedAt;

  const rawTldr = getField(parsed, 'tldr');
  const rawSummary = getField(parsed, 'summary');
  const rawSections = getField(parsed, 'sections');
  const rawTags = getField(parsed, 'tags');

  const result: SummarizeResult = {
    tldr: Array.isArray(rawTldr) ? rawTldr.filter((t): t is string => typeof t === 'string') : [],
    summary: typeof rawSummary === 'string' ? rawSummary : '',
    sections: Array.isArray(rawSections) ? rawSections.filter((s): s is KnowledgeSection => typeof s === 'object' && s !== null && 'title' in s) : [],
    tags: Array.isArray(rawTags) ? rawTags.filter((t): t is string => typeof t === 'string') : [],
    model: usedModel,
    promptId,
  };
  if (publishedAt !== undefined) result.publishedAt = publishedAt;
  return result;
}

export async function suggestTags(
  transcript: string,
  approvedTags: string[] = [],
  rejectedTags: string[] = [],
  rules?: string,
): Promise<string[]> {
  const resolvedRules = rules !== undefined ? rules : getTagRules();
  const rulesBlock = resolvedRules ? `Follow these tagging rules:\n${resolvedRules}\n\n` : '';

  const tagGuidance = [
    approvedTags.length
      ? `Preferred existing tags (reuse these when they fit): ${approvedTags.join(', ')}`
      : '',
    rejectedTags.length
      ? `Never use these tags (rejected): ${rejectedTags.join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const prompt = `${rulesBlock}Given the following content, suggest 3-6 topic tags ordered from most general to most specific.
Tags must use Title Case with spaces: "Unreal Engine", "Game Development". Acronyms stay uppercase: "AI", "LLM", "VR".
Reuse preferred tags wherever they apply. Only create new tags when none fit.
${tagGuidance}

Respond with ONLY a JSON array of strings, e.g.: ["AI", "Game Development", "Unreal Engine"]

Content:
${truncate(transcript)}`;

  const { content: text } = await llmComplete([{ role: 'user', content: prompt }]);

  const arrayMatch = text.match(/\[[\s\S]*?\]/);
  if (!arrayMatch) return [];
  try {
    const parsed: unknown = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    return [];
  }
}
