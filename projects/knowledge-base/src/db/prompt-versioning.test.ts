import { test, expect, describe } from 'bun:test';
import { buildSummaryPromptTemplate, buildSummaryLLMInput } from '../summarize-prompt.ts';

// The stored prompt template must be reusable across items — it cannot embed
// per-item content, or every summarization would create a fresh row in
// summary_prompt_templates, making template evolution impossible to track.
describe('summary prompt template storage', () => {
  const transcript = 'UNIQUE_TRANSCRIPT_MARKER_' + 'x'.repeat(5000);

  test('stored template does not contain item content', () => {
    const template = buildSummaryPromptTemplate({
      lang: 'english',
      keepTerms: true,
      detail: 'standard',
      hasKnownDate: false,
      tagGuidance: '',
    });

    expect(template).not.toContain('UNIQUE_TRANSCRIPT_MARKER_');
    expect(template).not.toContain(transcript);
  });

  test('template is identical for two different items with same settings', () => {
    const t1 = buildSummaryPromptTemplate({
      lang: 'english',
      keepTerms: true,
      detail: 'standard',
      hasKnownDate: false,
      tagGuidance: '',
    });
    const t2 = buildSummaryPromptTemplate({
      lang: 'english',
      keepTerms: true,
      detail: 'standard',
      hasKnownDate: false,
      tagGuidance: '',
    });
    expect(t1).toBe(t2);
  });

  test('LLM input combines template with content', () => {
    const template = buildSummaryPromptTemplate({
      lang: 'english',
      keepTerms: false,
      detail: 'brief',
      hasKnownDate: true,
      tagGuidance: '',
    });
    const llmInput = buildSummaryLLMInput(template, transcript);

    // LLM receives the full instruction plus the content.
    expect(llmInput.startsWith(template)).toBe(true);
    expect(llmInput).toContain(transcript);
    expect(llmInput).toContain('Content:');
  });

  test('template changes when settings change (drives new version row)', () => {
    const brief = buildSummaryPromptTemplate({
      lang: 'english',
      keepTerms: true,
      detail: 'brief',
      hasKnownDate: false,
      tagGuidance: '',
    });
    const detailed = buildSummaryPromptTemplate({
      lang: 'english',
      keepTerms: true,
      detail: 'detailed',
      hasKnownDate: false,
      tagGuidance: '',
    });
    expect(brief).not.toBe(detailed);
  });
});
