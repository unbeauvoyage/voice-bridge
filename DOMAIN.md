---
title: Canonical Domain Glossary
owner: chief-of-staff
created: 2026-04-15T23:35:00
status: living-document
summary: Single source of truth for domain concept names, types, and field shapes across all projects. Every team must use these names. Propose changes here before introducing variants.
---

# Domain Glossary

## Why this exists
Every team independently invented its own names: `agentName` vs `agent` vs `from`, `Issue` vs `Task` vs `BacklogItem`, `feature` vs `service` vs `module`. Result: TypeScript types do not match across boundaries, codex reviews flag "type drift" repeatedly, refactors break consumers silently. This document is the authoritative naming contract. Disagree? Open a proposal. Do not silently rename.

## Rule
Before introducing a new noun in any feature, service, type, store, or API: check this file. If the concept exists, use the canonical name. If it does not exist, add it here in the same PR.

---

## Core concepts

### Agent
A persistent or one-shot LLM process with an identity.
- **Field name:** `agent` (the entity), `agentName` (the string identifier)
- **Type:**
  ```ts
  type Agent = {
    name: string           // unique identifier, e.g. "chief-of-staff"
    type: AgentType        // definition file in .claude/agents/
    model: 'opus' | 'sonnet' | 'haiku'
    cwd: string            // absolute path
    sessionId?: string     // present if persistent
  }
  ```
- **NOT:** `userId`, `bot`, `assistant`, `from` (use `from` only as a transport-layer field on `Message`)

### Message
A relay envelope carrying communication between agents.
- **Type:**
  ```ts
  type Message = {
    id: string
    from: string           // sender agent name
    to: string             // recipient agent name
    type: MessageType      // see below
    body: string
    ts: string             // ISO 8601
  }
  type MessageType = 'message' | 'done' | 'status' | 'waiting-for-input' | 'escalate' | 'voice'
  ```
- **Canonical type values are CLOSED.** Adding a new value requires updating this glossary.

### Task
A unit of work with an owner and status, tracked in a TaskList.
- **Type:**
  ```ts
  type Task = {
    id: string
    subject: string        // imperative title
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'deleted'
    owner?: string         // agent name
    blockedBy?: string[]
    blocks?: string[]
  }
  ```
- **NOT:** `Todo`, `Item`, `Ticket`, `Story`. These are aliases for the same thing — pick `Task`.

### Issue
A bug or problem reported against the system. Distinct from Task.
- **Distinction:** Issues describe a *problem*. Tasks describe *work to do*. An issue can spawn one or many tasks.
- **Type:**
  ```ts
  type Issue = {
    id: string
    title: string
    body: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: 'open' | 'investigating' | 'fixed' | 'wontfix'
    reportedBy: string     // agent name or 'ceo'
    createdAt: string
  }
  ```
- **File location:** `~/environment/ISSUES.md`

### BacklogItem
An idea or aim, not yet approved as work. CEO promotes Backlog → Active.
- **Type:**
  ```ts
  type BacklogItem = {
    id: string
    title: string
    body: string
    section: 'Backlog' | 'Active' | 'Done' | 'Learnings'
    createdAt: string
  }
  ```
- **File location:** `~/environment/BACKLOG.md`

### Proposal
A structured plan for CEO approval — written to disk under `~/environment/proposals/`.
- **File:** frontmatter + markdown. See `~/environment/FORMATS.md`.
- **Required frontmatter:** `title`, `author`, `created`, `status`, `summary`, `audience`.

### Question
A learning question from the CEO that triggers research and a written answer.
- **File:** `~/environment/questions/{slug}.md` → answered in `~/environment/answers/{slug}.md`

### KnowledgeEntry
A captured article, video, or note in the knowledge-base.
- **Type:**
  ```ts
  type KnowledgeEntry = {
    id: string
    title: string
    body: string           // raw content or extracted text
    summary?: string       // LLM-generated
    tags?: string[]        // LLM-generated
    sourceUrl?: string
    createdAt: string
    status: 'queued' | 'processing' | 'done' | 'error'

    // User-curation fields (KB production schema, ratified 2026-04-15)
    starred?: boolean      // POST /items/:id/star toggle
    archived?: boolean     // POST /items/:id/archive toggle
    notes?: string         // POST /items/:id/notes
    rating?: number        // 1-5, POST /items/:id/rate
    collections?: string[] // collection IDs (many-to-many via collection_items)

    // Extraction + classification fields (KB production schema, ratified 2026-04-16)
    type: 'article' | 'youtube' | 'pdf' | 'twitter'  // KnowledgeItemType discriminator
    author?: string
    tldr?: string[]                // LLM-generated bullet points
    sections?: KnowledgeSection[]  // { title: string; points: string[] }[]
    error?: string                 // processing error message
    readAt?: string                // ISO timestamp, null if unread
    publishedAt?: string           // ISO timestamp from source
    pinned?: boolean
    studyLater?: boolean
    feedId?: string                // RSS feed source id
    feedName?: string
    imageUrl?: string
    summaryModel?: string          // e.g. 'gemma4:26b'
  }

  type KnowledgeSection = {
    title: string
    points: string[]
  }
  ```
- **Note:** `semantic` is a UI search-mode flag, NOT a KnowledgeEntry field. Lives in UI store, not the entity.
- **Note:** KB stores extracted text in `body`. Older code used `transcript` — `transcript` is deprecated; new code MUST use `body`.
- **Note:** `sourceUrl` is canonical (not `url`). DB column `date_added` is legacy and will migrate to `created_at` — JS field `createdAt` already matches canonical.
- **Status enum** (closed): `'queued' | 'processing' | 'done' | 'error'`. DB values confirmed 2026-04-16 via runtime audit; earlier TS variants (`pending`, `ready`) were dead code and removed.

### Feature (subject to rename → Service, see proposals/2026-04-15-features-vs-services-naming.md)
A self-contained slice of business logic exposing a public API via `index.ts`.
- **Folder shape:** `src/features/{name}/{index.ts, types.ts, store.ts, hooks/, domain/, components/}`
- **Public API contract:** consumers import only from `features/{name}` or `features/{name}/index.ts`. Internals are private.
- **NOT a Page.** A Feature does not own its routes. Pages compose Features.

### Page
A route-level composition. Imports Features and Components, owns the layout.
- **Folder:** `src/pages/{name}/`
- **Rule:** Pages must NOT contain business logic. Push it into a Feature.

### Component
A reusable UI primitive with no business logic.
- **Folder:** `src/components/`
- **Rule:** Components import only other Components and design tokens. No Feature imports.

### Session
A running Claude process with an identity, launched by `scripts/spawn-session.sh`.
- **Identity rule:** `RELAY_AGENT_NAME` == `--name` == cmux workspace name. All three must match.

### Team
A persistent group spawned via TeamCreate. Owns a TaskList.
- **Lifecycle:** members go idle between turns (normal), shut down via SendMessage `{type: 'shutdown_request'}`.

### Worklog
An append-only markdown log of an agent's work, at `.worklog/{agent-name}.md`.
- **Rule:** never edit, only append. New entries go at the bottom with timestamp.

### Wake Word
A spoken phrase that triggers voice capture. Currently `"hey jarvis"`.
- **Owner:** voice-bridge2 daemon.

### VoiceMessage
A recorded audio segment sent through the relay with `type: 'voice'`.
- **Field:** body is base64 audio or transcribed text (transcribed when possible, raw otherwise).

---

## Cross-cutting field name conventions

| Concept | Canonical name | Wrong |
|---|---|---|
| Sender | `from` | `sender`, `agent`, `who` |
| Recipient | `to` | `recipient`, `target`, `dest` |
| Timestamp | `ts` (ISO 8601 string) | `time`, `date`, `createdAt` (use `createdAt` only for entity creation, not message envelope) |
| Identifier | `id` | `_id`, `uuid`, `key` |
| Agent reference | `agentName` (string) or `agent: Agent` (object) | `name` alone is ambiguous |
| Status | `status` (closed enum per concept) | `state`, `phase` |

---

## How to add a concept
1. Open a PR editing this file (or send the diff to chief-of-staff).
2. Include: concept name, definition, canonical Type shape, what it is NOT.
3. Search the codebase for existing variants — list them so we can deprecate.
4. Wait for chief-of-staff approval before introducing the type in code.

---

## Open questions (parked for CEO discussion)
- **Feature → Service rename** (see proposal 2026-04-15-features-vs-services-naming.md)
- Should `Issue` and `BacklogItem` unify into a single `WorkItem` with a `kind` discriminator? Or keep separate?
- Where does `Spec` live? Currently `tests/` is the spec per the TDD rule, but some teams write `spec.md` files anyway. Reconcile.
