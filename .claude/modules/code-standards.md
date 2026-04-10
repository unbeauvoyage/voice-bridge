# AI-Optimized Code Standards

Every project team lead and coder MUST follow these standards. They exist because AI agents re-read the codebase from scratch each session — poor structure compounds into wasted tokens every time.

---

## Rule 1: Feature-Based Folder Structure

Organize by **what the code does**, not what pattern it implements.

**Do:**
```
features/
  voice-recording/
    components/
    hooks/
    store.ts      ← feature-specific Zustand slice
    api.ts        ← relay/network calls for this feature
    types.ts
  notifications/
    ...
```

**Don't:**
```
components/   ← all components regardless of domain
hooks/        ← all hooks regardless of domain
stores/       ← all stores regardless of domain
```

**Why:** Grep/Glob returns exactly one folder for a feature. Agent reads only what it needs.

---

## Rule 2: State Management — Slices in Features, Root Combines

- Each feature owns its Zustand slice: `feature/store.ts`
- Root `store/index.ts` composes slices — kept thin, rarely edited
- No monolithic god-store mixing unrelated concerns

**Why:** Agent working on voice recording reads `voice-recording/store.ts`. It doesn't need to parse 300 lines of unrelated state.

---

## Rule 3: File Naming — Behavior First

Name files after **what they do**, not what pattern they are.

| Bad | Good |
|-----|------|
| `service3.ts` | `sendRelayMessage.ts` |
| `hook.ts` | `useVoiceRecorder.ts` |
| `util.ts` | `markdownUtil.ts` |
| `index.ts` (re-export barrel) | avoid unless at feature root |

- Components: noun (`MessageCard.tsx`, `ProposalPanel.tsx`)
- Hooks: `use` + behavior (`useAgentStatus.ts`)
- API/actions: verb + noun (`sendMessage.ts`, `fetchProposals.ts`)
- Stores: feature + `Store` (`voiceStore.ts`, `notificationStore.ts`)

**Why:** The agent's first Glob/Grep hits the right file. No excavation needed.

---

## Rule 4: Avoid Barrel Index Files

Re-export index files (`index.ts` that just re-exports) force the agent to read the index AND follow every export. Skip them unless at a feature root to expose a public API.

**Exception:** `features/shared/index.ts` to expose cross-feature utilities is fine.

---

## Rule 5: Co-locate What Changes Together

If feature A's bug requires editing 5 different folders, the structure is wrong. Ask: "If I need to change X, how many top-level folders do I touch?" The answer should be 1-2.

- API call + its types + its store slice + its UI → all in the same feature folder
- Platform adapters that belong to a feature → `feature/platform/`

---

## Rule 6: Keep Files Focused

Files over ~300 lines in a component or ~500 lines in a page are a signal to split. Large files burn tokens even when the agent only needed 10 lines.

- Monolithic pages → extract sub-components by responsibility
- Monolithic stores → decompose into feature slices
- Monolithic utility files → split by behavior domain

---

## Applying to New Projects

Team leads must set up feature-based structure before writing any code. First commit = folder scaffold. Coders fill it in.

## Applying to Existing Projects

Refactors are **CEO-approved** (scope is large). Team leads propose, CEO decides.
See: `~/environment/proposals/` for the productivitesse refactor proposal.
