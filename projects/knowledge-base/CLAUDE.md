---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## TDD IS ABSOLUTE — See ~/environment/CLAUDE.md TDD section
Before writing ANY code: write a failing test first. Test name reported to team lead before implementation begins. No skip(). Run tests and show real output before marking done.

## ABSOLUTE RULE: NO test.skip() — EVER

`test.skip()`, `it.skip()`, `xtest()`, `xit()` are **banned**. No exceptions.

- A skipped test is a lie. It gives false confidence that the suite covers the feature.
- If a test requires infrastructure (Ollama, DB data, a live server), that infrastructure must be present and the test must genuinely pass — or the test must seed its own data.
- If a test can't currently pass, **fix it or delete it**. Never skip it.
- This applies to conditional skips too: `test.skip(condition, ...)` is still a skip.

**Enforcement:** The stop-gate hook checks for uncommitted skip() calls. Any PR or commit with a skip will be rejected.

---

## THE EXTENSION IS THE PRIMARY INTERFACE

**The Chrome extension is how the CEO actually uses this app.** The web app is secondary.

- Every feature must work in the extension first
- When fixing UI bugs, check the extension too — not just the web app
- When adding new UI elements (buttons, feedback, status), add them to the extension modal as well
- "Done" means working in the extension, not just the web app

---

## MANDATORY: Reflect Changes After Every Task

**After every coder task completes and code is committed, the team lead MUST run:**
```bash
bash scripts/restart-server.sh
```

This restarts the server so the browser gets fresh code. Without this, the CEO is looking at stale builds.

**Why this matters:**
- `bun --hot` hot-reload can panic on DB migrations → server crashes → browser HMR breaks
- Committed code in a worktree doesn't mean the running server has it
- Clean restart = predictable, reliable code reflection

**Rule:** No task is "done" until `scripts/restart-server.sh` has been run and the team lead has told the CEO: "changes are live — please Cmd+R once to reconnect."

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing — TDD Required

**Tests are the spec. No separate spec files.**

### Rules (mandatory, no exceptions)
1. **Coder writes a failing test first** — reports the test name to team lead before implementing
2. **No `test.skip()`** — ever. Tests must genuinely pass against a real server
3. **Name tests by capability/intent**, not by file or implementation: `"deleting an item removes all associated history"` not `"DELETE /items/:id"`
4. **Playwright for E2E** — `webServer` is wired in `playwright.config.ts` (already done)
5. **`bun test` for DB/unit tests** — use in-memory SQLite (`:memory:`) per test file for full isolation

### Test layers
- `tests/*.spec.ts` — Playwright E2E (UI + API integration), named by capability: `item-lifecycle.spec.ts`, not `app.spec.ts`
- `src/db/*.test.ts` — `bun test` unit tests for SQLite layer, one file per domain: `summary-versioning.test.ts`, `prompt-versioning.test.ts`, etc.

### Run tests
```bash
bun test                        # DB unit tests
bunx playwright test            # E2E tests (starts server automatically)
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
