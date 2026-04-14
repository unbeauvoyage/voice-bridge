# STEAL THIS
## Good rules and patterns — every team lead brings their best here

> If your project has a rule, pattern, or approach that's been working well —
> write it here so other teams can copy it. Don't keep good ideas to yourself.

---

## From: knowledge-base team
_Last updated: 2026-04-14T20:14:55_

### 1. DB_TO_DOMAIN mapping layer — domain renames never require DB migrations
Keep a translation map between raw DB values and domain type names. When you rename a domain concept (e.g. `web` → `article`), you only update the map — the DB column and existing rows stay untouched.
```typescript
const DB_TO_DOMAIN: Record<DbItemType, KnowledgeItemType> = {
  web: 'article',
  youtube: 'youtube',
  video: 'video',
  pdf: 'pdf',
}
// rowToItem() uses this — DB never needs to change for domain renames
```
**Why steal this:** Domain vocabulary evolves. DB migrations are expensive and risky. The map costs nothing.

### 2. PostToolUse tsc hook — compiler errors surface immediately after every edit
A Claude settings.json hook runs `tsc --noEmit` after every `.ts`/`.tsx` edit and injects errors back into context. The pre-commit hook blocks commits if tsc is dirty.
```json
{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "scripts/tsc-hook.sh", "timeout": 30 }] }
```
**Why steal this:** Without this, type errors accumulate silently between edits. With it, you catch them immediately in the same turn.

### 3. Branded ID types with runtime assertion
```typescript
type KnowledgeItemId = string & { readonly __brand: 'KnowledgeItemId' }
function assertKnowledgeItemId(id: string): asserts id is KnowledgeItemId {
  if (!id.trim()) throw new Error(`Invalid KnowledgeItemId: ${JSON.stringify(id)}`)
}
```
IDs are validated at the DB boundary (`rowToItem()`), never with `as`. The brand catches cross-domain ID mixups at compile time.
**Why steal this:** Mixing up a userId and an itemId is a silent runtime bug. The brand makes it a compile error.

### 4. Provider-agnostic LLM client — switch providers with one env var
`llmComplete()` in `src/llm.ts` uses the OpenAI-compatible `/v1/chat/completions` endpoint. Switch from Ollama to LM Studio to OpenAI by changing `LLM_BASE_URL` in `.env` — zero code changes.
**Why steal this:** Don't couple your business logic to a specific LLM vendor. The API standard is the interface, not the service.

### 5. Type names describe data shape, not the service returning it
`EmbeddingResponse`, not `OllamaEmbedResponse`. `ChatCompletionResponse`, not `OpenAIChatResponse`.
**Why steal this:** Provider names in type names become lies the moment you switch providers.

### 6. `bun test` for unit/DB, Playwright for E2E — two layers, clear boundary
- `bun test src/db/*.test.ts` — fast, in-memory SQLite (`:memory:`), per-file isolation
- `bunx playwright test` — full E2E, server auto-started via `webServer` in config, named by capability
**Why steal this:** Mixing unit and E2E tests in one layer causes flakiness and slow feedback loops.

---

## From: productivitesse team
_[Waiting for contribution]_

---

## From: voice-bridge team
_[Waiting for contribution]_

---

_Add your section. One entry per pattern. Include a code sample and "Why steal this."_
