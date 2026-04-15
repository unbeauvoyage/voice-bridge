# Hook Pattern — voice-bridge2 Compiler Feedback

## Pattern: PostToolUse typecheck + .compiler-debt.md diff shim

**Purpose:** Agents see tsc/eslint/bun-test errors immediately after every TypeScript edit, mid-coding. Only **new** errors surface — pre-existing debt is suppressed after first baseline capture.

Ported from productivitesse/.claude/hooks (commit 0fb6273). Adaptations for vb2 are documented in the "Differences from productivitesse" section below.

### Files
- `.claude/hooks/post-edit-typecheck.sh` — the hook script (PostToolUse)
- `.claude/hooks/session-start-baseline.sh` — surfaces counts on session start
- `.claude/.compiler-debt.md` — baseline tsc errors (auto-generated, gitignored)
- `.claude/settings.json` — wires hooks to PostToolUse + SessionStart events

### How it works
1. **First run:** no `.compiler-debt.md` exists → captures all current tsc errors as baseline
2. **Subsequent runs:** diffs current tsc output against baseline with `comm -13` → only new errors shown
3. Output is JSON `hookSpecificOutput.additionalContext` injected into model context

### Wiring (settings.json)
```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Write|Edit|MultiEdit", "hooks": [{ "type": "command", "command": "bash .claude/hooks/post-edit-typecheck.sh", "timeout": 60 }] }],
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash .claude/hooks/session-start-baseline.sh", "timeout": 30 }] }]
  }
}
```

### Guard pattern
```
/projects/voice-bridge2/(src|server)/.*\.ts$
```
Covers main (`src/main/`), preload (`src/preload/`), renderer (`src/renderer/`), and server (`server/`). No `.tsx` — vb2 renderer is pure `.ts` via React with JSX factory syntax not used, so `.ts` is sufficient. Skips `.d.ts`.

### Differences from productivitesse
| Concern | productivitesse | voice-bridge2 |
|---|---|---|
| tsc | single `tsc --noEmit --incremental` | three projects: node + web + server |
| test runner | vitest | bun test |
| test discovery | `src/**/__tests__/{name}.test.ts` | colocated `{dir}/{basename}.test.ts` |
| lint scope | `src` only | whole repo via `eslint .` |
| file extensions | `.ts` + `.tsx` | `.ts` only |

### Pipe-test
```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"/Users/riseof/environment/projects/voice-bridge2/src/main/ipc.ts"}}' | bash .claude/hooks/post-edit-typecheck.sh
```
Expected output (once baseline captured): a single JSON line with `tsc: clean (N pre-existing suppressed) | eslint: clean (0 warnings) | tests: 14 passed`.

### First-run bootstrap
1. Delete any stale `.claude/.compiler-debt.md`
2. Trigger any edit on a file under src/ or server/ — first run writes baseline
3. `.compiler-debt.md` is gitignored; each machine captures its own baseline
