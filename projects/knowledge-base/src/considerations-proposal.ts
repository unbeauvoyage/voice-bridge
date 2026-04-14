import { $ } from 'bun';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger.ts';
import type { KnowledgeItem } from './types.ts';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'untitled';
}

/**
 * Writes a proposal file to ~/environment/proposals/ describing a KB item
 * that the CEO has raised for agent consideration. Agents in the environment
 * monitor that directory and can pick up the proposal to think about how to
 * apply, adapt, or implement the item's content.
 */
export async function writeConsiderationProposal(item: KnowledgeItem, ceoNote?: string): Promise<string> {
  try {
    const timestamp = (await $`date "+%Y-%m-%dT%H:%M:%S"`.text()).trim();
    const dateOnly = timestamp.split('T')[0];
    const titleSlug = slugify(item.title || item.id);
    const filename = `${dateOnly}-kb-${titleSlug}-${item.id.slice(-6)}.md`;
    const proposalsDir = join(homedir(), 'environment', 'proposals');
    const outPath = join(proposalsDir, filename);

    const tldrLines = Array.isArray(item.tldr) ? item.tldr : [];
    const tldrBlock = tldrLines.length
      ? tldrLines.map((l) => `- ${l}`).join('\n')
      : '(no TL;DR available)';

    const summaryExcerpt = (item.summary || '').slice(0, 1200);
    const shortTitle = (item.title || 'Untitled').replace(/"/g, "'").slice(0, 120);
    const trimmedNote = ceoNote?.trim() || '';
    const summaryLine = trimmedNote
      ? `CEO raised KB item "${shortTitle}" — ${trimmedNote.slice(0, 160).replace(/\n/g, ' ')}`
      : `CEO raised KB item "${shortTitle}" for agent consideration — review and decide how to apply it.`;

    const ceoQuestionSection = trimmedNote
      ? `## CEO's Question\n\n"${trimmedNote}"\n\n`
      : '';

    const body = `---
type: proposal
title: Consider KB item — ${shortTitle}
summary: ${summaryLine}
status: pending
author: knowledge-base
created: ${timestamp}
priority: medium
---

# Consider KB item — ${shortTitle}

The CEO flagged a knowledge-base item for agent review.

${ceoQuestionSection}## Item

- **Title:** ${item.title || '(untitled)'}
- **URL:** ${item.url}
- **Item ID:** ${item.id}
- **Type:** ${item.type}

## TL;DR

${tldrBlock}

## Summary excerpt

${summaryExcerpt || '(no summary available)'}

## Agent Instructions

1. Read the KB item summary above (full item available in KB web app or via the URL).
2. Do additional web research if needed to evaluate it.
3. Compare it to our current workflow and tools.
4. Write a report with your findings and **relay it to \`command\`**.
5. Update the consideration record with \`PATCH /considerations/:id\` (status + agent notes) once done.
`;

    await Bun.write(outPath, body);
    logger.info('[considerations]', `wrote proposal ${outPath}`);
    return outPath;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[considerations]', `failed to write proposal: ${msg}`);
    throw err;
  }
}
