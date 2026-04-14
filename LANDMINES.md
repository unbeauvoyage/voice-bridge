# LANDMINES
## Things that have blown up in our faces — every team lead warns the others

> If something caused you real pain — a silent bug, a bad pattern, a wrong assumption —
> write it here so other teams don't step on the same mine.

---

## From: knowledge-base team
_Last updated: 2026-04-14T20:14:55_

### 💣 1. `as Type` casts on API/DB boundaries — silent type lies that survive until production
Casting `req.json() as MyShape` or `row as MyItem` tells the compiler "trust me" — and the compiler does, even when you're wrong. The mismatch explodes at runtime with no compile-time warning.
**What we did instead:** Assign to `unknown`, then use type guards (`isMyShape(v)`). The guard is tested. The cast was a promise with no enforcement.

### 💣 2. `!` non-null assertions on array access — `items[i]!` crashes when the array is shorter than expected
With `noUncheckedIndexedAccess` enabled, `items[i]` is `T | undefined`. We were suppressing that with `!` everywhere. Three crashes later we switched to explicit guards.
**What we did instead:** `const item = items[i]; if (!item) continue;` — one extra line, zero crashes.

### 💣 3. Stale stop-gate dirty files blocking agents across sessions
The stop-gate hook tracks modified files in `/tmp/tg-dirty-{SESSION_ID}-{CWD_HASH}`. When a session ends and a new one starts with a different session ID, the old dirty file is never cleared — the new session gets blocked even though tests passed.
**Fix:** `rm -f /tmp/tg-dirty-*-{CWD_HASH}` when you see unexplained stop-gate blocks on a fresh session.

### 💣 4. `dateAdded` vs `createdAt` — field name drift between DB, domain, and frontend
The DB column was `date_added`, our domain type called it `dateAdded`, the shared domain contract called it `createdAt`. Three names for the same thing caused type errors across 12+ files when we aligned with the shared contract.
**Lesson:** Agree on field names before writing the first line of schema. Renaming is expensive when it spans DB column → Drizzle schema → domain type → frontend → extension.

### 💣 5. `bun --hot` can panic on DB migrations — server crashes silently, HMR breaks
When a migration runs during a hot-reload session, Bun's `--hot` watcher can panic and exit. The browser's HMR connection drops. The CEO is looking at stale code with no error message.
**Fix:** `scripts/restart-server.sh` — full clean restart after every commit. Never rely on hot-reload for schema-changing commits.

### 💣 6. Worktree tests failing due to missing migration files
Tests in isolated git worktrees fail because Drizzle migration files are committed to the main branch but not yet in the worktree's branch. Looks like real test failures but isn't.
**Fix:** Always check migration file presence in worktrees before treating DB-related test failures as real bugs.

### 💣 7. Excluded directories invisible to tsc — bugs ship undetected
If a source directory is missing from `tsconfig.json` `include`, tsc runs clean even when that directory has type errors. A `ReferenceError` shipped to production this way.
**Fix:** Every source directory must be in `tsconfig include`. Add the PostToolUse tsc hook so you catch it immediately.

### 💣 8. Provider-specific names in shared types — lies that outlive the decision
We named a type `OllamaEmbedResponse`. Two weeks later we discussed switching to LM Studio. The type name would have been wrong before we even shipped.
**Fix:** Name types after what they represent, not who returns them. `EmbeddingResponse`, not `OllamaEmbedResponse`.

---

## From: productivitesse team
_[Waiting for contribution]_

---

## From: voice-bridge team
_[Waiting for contribution]_

---

_Add your section. One landmine per entry. Be specific: what broke, what the symptom was, what the fix is._
