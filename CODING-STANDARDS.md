---
name: Cross-Project Coding Standards
description: Canonical, tooling-enforced coding standards for every project in ~/environment
summary: Strict, LLM-safe standards enforced by TypeScript, ESLint, commitlint, husky, and file-size caps
version: 1.0.0
lastUpdated: 2026-04-10T00:00:00
owner: agentflow-expert
---

# Cross-Project Coding Standards

**Scope:** Every project under `~/environment/` and `~/environment/projects/` — current (`message-relay`, `productivitesse`, future `knowledge-base`) and future. Project CLAUDE.md files MUST reference this document.

**Pinned versions (as of 2026-04-10):**
- TypeScript 5.7
- ESLint 9 (flat config)
- typescript-eslint 8
- Prettier 3
- vitest 4.1
- husky 9
- lint-staged 15
- commitlint 19
- eslint-plugin-unicorn 56
- eslint-plugin-import-x 4
- eslint-plugin-boundaries 5

---

## 0. Purpose and Enforcement Philosophy

Rules that depend on goodwill are ignored by LLMs. Every rule in this document is enforced by a failing check: `tsc --noEmit`, ESLint, commitlint, husky hooks, or CI. There is no "please try to" — only "the build fails if." When an LLM generates code that violates a rule, the pre-commit hook rejects the commit, forcing the agent to split the file, remove the `any`, or rewrite the import. This is deliberate: LLMs sail past prose guidance but cannot sail past a failing exit code.

---

## 1. Project Skeleton from Day One

Every new project starts with the following files. The bootstrap script in section 10 creates all of this.

### 1.1 Directory layout

```
<project>/
  package.json
  tsconfig.json
  tsconfig.eslint.json
  eslint.config.js
  .prettierrc
  .prettierignore
  .editorconfig
  .gitignore
  .husky/
    pre-commit
    commit-msg
    pre-push
  .lintstagedrc.json
  commitlint.config.js
  commit-scopes.json
  vitest.config.ts
  CLAUDE.md
  CODING-STANDARDS.md -> ../../CODING-STANDARDS.md (symlink or reference)
  README.md
  src/
    features/
    shared/
    domain/
    data/
    app/
  test/
  .github/workflows/ci.yml   # if using GitHub Actions
```

### 1.2 `package.json`

```json
{
  "name": "<project-name>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.11.0" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepare": "husky",
    "verify": "npm run typecheck && npm run lint && npm run test"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.5.0",
    "@commitlint/config-conventional": "^19.5.0",
    "@types/node": "^22.9.0",
    "@typescript-eslint/eslint-plugin": "^8.15.0",
    "@typescript-eslint/parser": "^8.15.0",
    "@vitest/coverage-v8": "^4.1.0",
    "eslint": "^9.15.0",
    "eslint-import-resolver-typescript": "^3.6.3",
    "eslint-plugin-boundaries": "^5.0.1",
    "eslint-plugin-import-x": "^4.4.0",
    "eslint-plugin-unicorn": "^56.0.0",
    "husky": "^9.1.0",
    "lint-staged": "^15.2.0",
    "prettier": "^3.3.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.15.0",
    "vitest": "^4.1.0"
  }
}
```

### 1.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": ".",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,

    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "baseUrl": ".",
    "paths": {
      "@features/*": ["src/features/*"],
      "@shared/*":   ["src/shared/*"],
      "@domain/*":   ["src/domain/*"],
      "@data/*":     ["src/data/*"],
      "@app/*":      ["src/app/*"],
      "@test/*":     ["test/*"]
    }
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist", "build"]
}
```

`tsconfig.eslint.json` (used by typescript-eslint for linting tests and configs):

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*", "test/**/*", "*.config.ts", "*.config.js"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 `eslint.config.js` — see section 3 for full content.

### 1.5 `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 1.6 `.prettierignore`

```
dist
build
coverage
node_modules
*.min.js
```

### 1.7 `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

### 1.8 `.gitignore`

```
node_modules
dist
build
coverage
.DS_Store
*.log
.env
.env.local
.vite
.cache
```

### 1.9 `.husky/pre-commit`

```sh
#!/usr/bin/env sh
npx lint-staged
```

### 1.10 `.husky/commit-msg`

```sh
#!/usr/bin/env sh
npx commitlint --edit "$1"
```

### 1.11 `.husky/pre-push`

```sh
#!/usr/bin/env sh
protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

# Reject force pushes to main
if [ "$current_branch" = "$protected_branch" ]; then
  remote_sha=$(git rev-parse "origin/$protected_branch" 2>/dev/null || echo "")
  local_sha=$(git rev-parse HEAD)
  if [ -n "$remote_sha" ] && ! git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
    echo "ERROR: Non-fast-forward push to $protected_branch is forbidden."
    exit 1
  fi
fi

# Reject WIP commits
if git log @{u}.. --format=%s 2>/dev/null | grep -Ei '^wip' >/dev/null; then
  echo "ERROR: Refusing to push commits with 'wip' subject."
  exit 1
fi
```

### 1.12 `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
    "bash -c 'tsc --noEmit -p tsconfig.json'",
    "vitest related --run --passWithNoTests"
  ],
  "*.{js,jsx,json,md,yml,yaml}": [
    "prettier --write"
  ]
}
```

**Note:** `--no-warn-ignored` is required. Without it, ESLint emits a warning whenever lint-staged passes a file that matches the project's ESLint `ignores` list (e.g. `vitest.config.ts`, `eslint.config.js`), and `--max-warnings=0` converts that warning into a failure. The flag tells ESLint to silently skip ignored files instead of warning.

### 1.13 `commitlint.config.js` — see section 6.

### 1.14 `commit-scopes.json`

```json
{
  "scopes": [
    "core",
    "shared",
    "domain",
    "data",
    "app",
    "ci",
    "deps",
    "build",
    "config"
  ],
  "note": "Add feature-specific scopes as features are added. Scopes must be kebab-case."
}
```

### 1.15 `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared':   fileURLToPath(new URL('./src/shared',   import.meta.url)),
      '@domain':   fileURLToPath(new URL('./src/domain',   import.meta.url)),
      '@data':     fileURLToPath(new URL('./src/data',     import.meta.url)),
      '@app':      fileURLToPath(new URL('./src/app',      import.meta.url)),
      '@test':     fileURLToPath(new URL('./test',         import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/index.ts'],
    },
  },
});
```

### 1.16 `CLAUDE.md` (project template)

```markdown
# <Project Name>

**Follows cross-project standards:** `~/environment/CODING-STANDARDS.md` (canonical).

This file contains project-specific rules only. System-wide rules (strict TS, vertical slices,
file-size cap, commit conventions, pre-commit hooks) are defined in CODING-STANDARDS.md and
enforced by tooling. Do not re-document them here.

## Project-specific sections
- Branch policy
- Build/deploy commands
- Tech stack specifics
- Team structure
```

### 1.17 `.github/workflows/ci.yml` (if GitHub CI applies)

```yaml
name: CI
on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test -- --coverage
      - name: commitlint
        run: npx commitlint --from=${{ github.event.pull_request.base.sha || 'HEAD~10' }} --to=HEAD
```

---

## 2. TypeScript Strict Config — Flag-by-Flag

Every flag below is MANDATORY. Disabling any of them requires a written exception (section 12).

| Flag | Value | Why |
|---|---|---|
| `strict` | `true` | Baseline — enables all strict checks |
| `noUncheckedIndexedAccess` | `true` | `arr[0]` is `T \| undefined`, not `T`. Prevents off-by-one crashes |
| `exactOptionalPropertyTypes` | `true` | `{ x?: number }` disallows `{ x: undefined }` — forces meaningful absence semantics |
| `noImplicitOverride` | `true` | Subclass methods must say `override` — prevents accidental shadowing |
| `noPropertyAccessFromIndexSignature` | `true` | Forces `obj['foo']` for dynamic keys, reserving `obj.foo` for declared ones |
| `noFallthroughCasesInSwitch` | `true` | Catches missing `break`/`return` in switch blocks |
| `noImplicitReturns` | `true` | Every code path must return explicitly |
| `useUnknownInCatchVariables` | `true` | `catch (e)` makes `e` `unknown`, not `any` |
| `forceConsistentCasingInFileNames` | `true` | Required on case-insensitive filesystems (macOS) |
| `isolatedModules` | `true` | Each file must be independently transpilable — required for modern bundlers |
| `verbatimModuleSyntax` | `true` | Forces explicit `import type` for type-only imports — cleaner output |

**Target / module settings:**
- `target: "ES2022"` — modern runtime features (top-level await, error cause, etc.)
- `module: "ESNext"`, `moduleResolution: "Bundler"` — matches Vite/Vitest/modern tooling
- `lib: ["ES2022", "DOM", "DOM.Iterable"]` — Node-only projects may drop DOM

**Note on `verbatimModuleSyntax` + extensions:** With `moduleResolution: "Bundler"` (Vite/Vitest), relative imports do NOT require `.js` extensions — the bundler resolves them. For plain `tsc`-emitted Node ESM projects (no bundler), switch to `moduleResolution: "NodeNext"` and write explicit `.js` extensions in relative imports. Projects must pick one mode and commit to it.

**Path aliases:** exactly the six below, no variations:
- `@features/*` → `src/features/*`
- `@shared/*` → `src/shared/*`
- `@domain/*` → `src/domain/*`
- `@data/*` → `src/data/*`
- `@app/*` → `src/app/*`
- `@test/*` → `test/*`

---

## 3. ESLint Ruleset — Full Flat Config

Create `eslint.config.js` at the project root with EXACTLY this content:

```js
// eslint.config.js — cross-project standard. Do not edit without approval from agentflow-expert.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import boundaries from 'eslint-plugin-boundaries';
import unicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
      unicorn,
    },
    settings: {
      'import-x/resolver': {
        typescript: { project: './tsconfig.eslint.json' },
      },
    },
    rules: {
      // ---------- Type safety ----------
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/strict-boolean-expressions': ['warn', { allowString: false, allowNumber: false, allowNullableObject: false }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // ---------- Hard file/function size boundaries ----------
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
      complexity: ['error', 15],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      'max-nested-callbacks': ['error', 3],

      // ---------- Import hygiene ----------
      'import-x/no-default-export': 'error',
      'import-x/no-cycle': ['error', { maxDepth: 10 }],
      'import-x/no-self-import': 'error',
      'import-x/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@features/**', group: 'internal', position: 'after' },
          { pattern: '@shared/**',   group: 'internal', position: 'after' },
          { pattern: '@domain/**',   group: 'internal', position: 'after' },
          { pattern: '@data/**',     group: 'internal', position: 'after' },
          { pattern: '@app/**',      group: 'internal', position: 'after' },
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],

      // ---------- Layer boundaries (shared/domain/data/app) ----------
      // `target` = where the import is written. `from` = path that cannot be imported.
      'import-x/no-restricted-paths': ['error', {
        zones: [
          // shared may not import features
          { target: './src/shared',  from: './src/features' },
          { target: './src/shared',  from: './src/app' },
          // domain is pure: may not import features, shared, data, or app
          { target: './src/domain',  from: './src/features' },
          { target: './src/domain',  from: './src/shared' },
          { target: './src/domain',  from: './src/data' },
          { target: './src/domain',  from: './src/app' },
          // data may not import features or domain internals beyond schemas
          { target: './src/data',    from: './src/features' },
          { target: './src/data',    from: './src/app' },
          // features may not import app (composition root)
          { target: './src/features', from: './src/app' },
        ],
      }],

      // ---------- Feature-to-feature isolation (eslint-plugin-boundaries) ----------
      // no-restricted-paths cannot enforce per-feature index.ts surfaces with globs.
      // eslint-plugin-boundaries models element types and allows only transitions we permit.
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'feature', allow: [['feature', { featureName: '${from.featureName}' }], 'shared', 'domain', 'data'] },
          { from: 'shared',  allow: ['shared', 'domain', 'data'] },
          { from: 'domain',  allow: ['domain'] },
          { from: 'data',    allow: ['data', 'domain'] },
          { from: 'app',     allow: ['feature', 'shared', 'domain', 'data', 'app'] },
        ],
      }],
      'boundaries/external': ['error', { default: 'allow' }],
      'boundaries/no-private': ['error', { allowUncles: false }],

      // ---------- Filename convention ----------
      'unicorn/filename-case': ['error', {
        cases: { kebabCase: true, pascalCase: true },
        ignore: ['^README\\.md$', '^CLAUDE\\.md$'],
      }],
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/prefer-node-protocol': 'error',

      // ---------- Misc discipline ----------
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-param-reassign': 'error',
    },
  },

  // React components: PascalCase filenames, default exports allowed for route modules
  {
    files: ['src/**/*.tsx'],
    rules: {
      'unicorn/filename-case': ['error', { case: 'pascalCase' }],
    },
  },

  // Route files (framework-required default exports)
  {
    files: ['src/app/routes/**/*.{ts,tsx}', 'app/routes/**/*.{ts,tsx}'],
    rules: {
      'import-x/no-default-export': 'off',
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],
    },
  },

  // Tests: relax size and function-length caps, allow non-null assertions
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': ['error', { max: 500 }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
```

**Why each hard boundary exists:**
- `max-lines: 300` — LLMs burn tokens reading 1000-line files to change 5 lines. Forces splitting.
- `max-lines-per-function: 80` — long functions break humans and LLMs equally. Extract.
- `complexity: 15` — cyclomatic complexity cap. More = rewrite as table-driven or split.
- `max-depth: 4` — nested `if/for/try` deeper than 4 is unreadable. Extract helpers.
- `max-params: 5` — more than 5 args = group into an options object.
- `import-x/no-restricted-paths` — **the key vertical-slice enforcement**. Without this, LLMs cheerfully reach into other features' internals and destroy the architecture.

---

## 4. Vertical Slice Architecture — Hard Directory Structure

### 4.1 The layout

```
src/
  features/
    <feature-name>/
      components/        # React components (only in UI projects)
      hooks/             # React hooks local to this feature
      store.ts           # Zustand store or equivalent — max 1 per feature
      types.ts           # Types local to this feature
      api.ts             # Network calls for this feature
      __tests__/         # Co-located tests
      index.ts           # Public surface — ONLY file other features may import from
  shared/
    components/          # Cross-feature UI primitives (Button, Modal, etc.)
    hooks/               # Cross-feature hooks
    utils/               # Pure functions
    types/               # Cross-feature types
  domain/                # Business logic, framework-independent
    schemas/             # Zod schemas
    services/            # Cross-cutting domain services
  data/                  # Platform bindings — filesystem, HTTP, OS APIs
  app/                   # App shell, routing, composition root
test/                    # Test helpers only (NOT tests themselves)
```

### 4.2 Import rules (enforced by `import-x/no-restricted-paths`)

| From | May import from |
|---|---|
| `features/X/` (internal files) | own feature, `shared/`, `domain/`, `data/` |
| `features/X/index.ts` | own feature only (it IS the public surface) |
| `features/Y/` | `features/X/index.ts` only — never `features/X/components/Foo.ts` |
| `shared/` | `shared/`, `domain/`, `data/` — NOT `features/` |
| `domain/` | `domain/` only — pure business logic, zero deps |
| `data/` | `data/`, `domain/` — NOT `features/`, NOT `shared/` |
| `app/` | everything (composition root) |

**The golden rule:** if ESLint rejects the import, the architecture is telling you that code belongs somewhere else. Move it — do not `// eslint-disable`.

### 4.3 What goes where — decision table

| You are adding... | Put it in |
|---|---|
| A UI screen for a specific feature | `features/<feature>/components/` |
| A button used in 3+ features | `shared/components/` |
| A Zod schema for a domain entity | `domain/schemas/` |
| A function that talks to the filesystem | `data/` |
| A React hook used in 1 feature | `features/<feature>/hooks/` |
| A React hook used in many features | `shared/hooks/` |
| The app's router / main entry | `app/` |
| A pure math helper | `shared/utils/` or `domain/` (if business rule) |

### 4.4 `features/X/index.ts` is the feature's public contract

Example — `src/features/voice-recording/index.ts`:

```ts
export { useVoiceRecorder } from './hooks/use-voice-recorder.js';
export { VoiceRecordingPanel } from './components/VoiceRecordingPanel.js';
export type { VoiceRecordingState } from './types.js';
```

That is the ONLY surface other features see. `store.ts`, `api.ts`, internal components are all private.

---

## 5. File Naming Conventions — LLM-Friendly

| Kind | Case | Example | Enforced by |
|---|---|---|---|
| TypeScript module (non-component) | kebab-case | `user-session.ts` | `unicorn/filename-case` |
| React component | PascalCase | `SessionCard.tsx` | override for `*.tsx` |
| Test file | kebab-case + `.test.ts` | `relay-client.test.ts` | convention |
| Route module | kebab-case | `overlay.tsx` | route override |
| Feature index | `index.ts` | `features/voice-recording/index.ts` | convention |
| Zod schema | kebab-case + noun | `proposal.ts`, `agent-activity.ts` | filename-case |

**Additional rules:**

- **Max 300 lines per file.** Enforced. Hitting the cap = split the file. Do not add `// eslint-disable-next-line max-lines`.
- **One symbol per file (soft):** if a file exports more than 3 unrelated symbols, consider splitting. Not enforced, but reviewers should flag.
- **Name files by content, not architectural layer:** `session-store.ts`, not `store.ts`. **Exception:** inside a feature directory, `store.ts`, `api.ts`, `types.ts`, `index.ts` are OK because the parent directory name disambiguates (`features/voice-recording/store.ts` is unambiguous).
- **No barrel files except at feature roots.** `features/X/index.ts` is the only `index.ts` allowed. Internal re-export barrels force agents to jump through indirection — banned.
- **Test files co-located:** `features/voice-recording/__tests__/use-voice-recorder.test.ts`, not a mirrored `test/features/voice-recording/...` tree.

---

## 6. Commit Messages — Enforced by Commitlint

### 6.1 Format

```
<type>(<scope>): <subject>

<body — wrapped at 100 chars>

<footer — optional trailers, NO AI attribution>
```

Examples:
- `feat(relay): add peer-channel file watcher`
- `fix(dashboard): correct proposal sort order on empty state`
- `refactor(voice-recording): extract waveform logic into hook`

### 6.2 Hard rules (all enforced by commitlint)

- **Subject max length: 72 chars.**
- **Subject must be imperative mood** — "add X" not "added X" or "adds X". Enforced via commitlint.
- **Type required** — one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `revert`. No others.
- **Scope required** — must match an entry in `commit-scopes.json`.
- **No trailing period on subject.**
- **Body wraps at 100 chars.**
- **No `Co-Authored-By: Claude`** or any AI attribution (existing environment policy).
- **No `wip` subjects** pushed to shared branches (rejected by pre-push hook).

### 6.3 `commitlint.config.js`

```js
// commitlint.config.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scopes = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'commit-scopes.json'), 'utf8'),
).scopes;

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'style', 'revert']],
    'scope-enum': [2, 'always', scopes],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', ['lower-case', 'sentence-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 100],
  },
};
```

Imperative-mood enforcement: the `subject-case` rule combined with the conventional `subject-empty` checks gets most of the way. For strict imperative enforcement, add `commitlint-plugin-tense` as an optional upgrade in a future version.

---

## 7. Pre-Commit and Commit-Msg Hooks

All hooks live in `.husky/`. Install with `npm run prepare` (which runs `husky`).

### 7.1 What runs on each commit

**`.husky/pre-commit` → `npx lint-staged`:**
- `eslint --fix --max-warnings=0 --no-warn-ignored` on staged `.ts`/`.tsx` files (the `--no-warn-ignored` flag prevents `file ignored` warnings from tripping `--max-warnings=0` when lint-staged passes files in the ESLint ignores list)
- `prettier --write` on staged files
- `tsc --noEmit` on the whole project (fast in incremental mode)
- `vitest related --run --passWithNoTests` for tests affected by staged files

**`.husky/commit-msg` → `npx commitlint --edit "$1"`:**
- Validates the commit message against `commitlint.config.js`

**`.husky/pre-push`:**
- Rejects non-fast-forward pushes to `main`
- Rejects pushes containing `wip` subjects

### 7.2 Why not run full tests in pre-commit?

`vitest related` runs only tests whose dependency graph touches staged files. Full suite runs in CI. Rationale: pre-commit must be fast or agents will try to bypass it.

### 7.3 `--no-verify` is forbidden (with one narrow exception)

Team leads and coders must NEVER pass `--no-verify` to `git commit` or `git push`. If hooks reject the commit, fix the code — do not bypass. CEO has said this explicitly in `~/environment/CLAUDE.md`: "only take risky actions carefully." `--no-verify` qualifies as risky.

**The only allowed exception:** the very first bootstrap commit created by `bootstrap-project.sh`. At that moment the project has just been scaffolded, `husky install` has not finished wiring hooks, and `npm install` is still warming up — no human or LLM is making a judgment call. The bootstrap script uses `--no-verify` once and only for the initial `chore(config): bootstrap project skeleton from coding standards` commit. Every subsequent commit — including the very next one — must go through hooks normally.

No other exception exists. Not for "I'm in a hurry," not for "CI will catch it," not for "just this one WIP push." If you find yourself typing `--no-verify` outside the bootstrap context, stop and fix the code.

---

## 8. Test Structure and Expectations

### 8.1 Tooling

- **Unit & integration:** vitest 4.1
- **E2E (where applicable):** Playwright (productivitesse already uses it)
- **Coverage provider:** `@vitest/coverage-v8`

### 8.2 File conventions

- Co-locate: `features/voice-recording/__tests__/use-voice-recorder.test.ts`
- File name mirrors source: `use-voice-recorder.ts` → `use-voice-recorder.test.ts`
- Test files use `*.test.ts` (preferred) or `*.spec.ts`

### 8.3 Coverage

- No hard percentage enforcement yet (projects at different maturity).
- CI MUST publish `vitest --coverage` as an artifact.
- **Every new feature ships with at least one test** touching its store or primary logic. Enforced by review — reviewers reject PRs that add `features/*` without a `__tests__/` directory.

### 8.4 What to test

- **Stores** — every Zustand slice has at least one test for its reducer/actions
- **Pure domain logic** — 100% of non-trivial branches
- **Schemas** — round-trip `parse`/`stringify`
- **UI components** — smoke test that renders without crash; interaction tests where feasible
- **API calls** — mock the transport layer, test request shaping

---

## 9. Migration Plan for Existing Projects

### 9.1 `message-relay` (`~/environment/message-relay/`)

**Current state:**
- Node/Fastify project, CommonJS, TS 5.4
- `tsconfig.json` already has: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`
- Missing: `verbatimModuleSyntax`, `isolatedModules`, `noFallthroughCasesInSwitch`, path aliases
- **No ESLint, no Prettier, no husky, no lint-staged, no commitlint** — completely unenforced
- `src/` is flat: `types.ts`, `discovery.ts`, `attachments.ts`, `persistence.ts`, `logger.ts`, `jsonlWatcher.ts`, `delivery.ts`, `index.ts` — NOT vertical slice. No features, no shared, no domain, no data.
- `src/index.ts` is likely > 300 lines (main Fastify entry point)
- `module: "commonjs"` — must migrate to ESM to match the standard

**Migration steps (ordered):**

1. **Audit file sizes** — identify files > 300 lines. Likely culprits: `src/index.ts`, possibly `delivery.ts`, `persistence.ts`. Count with `wc -l src/*.ts`.
2. **Add dev deps** — ESLint 9, Prettier 3, husky 9, lint-staged 15, commitlint 19, typescript-eslint 8, eslint-plugin-import-x, eslint-plugin-unicorn.
3. **Copy configs** — `eslint.config.js`, `.prettierrc`, `.husky/*`, `.lintstagedrc.json`, `commitlint.config.js`, `commit-scopes.json` (with scopes: `core`, `delivery`, `persistence`, `discovery`, `attachments`, `logger`, `ci`, `deps`, `config`).
4. **Run `npm install` + `husky install`**.
5. **Update tsconfig** — add missing flags, path aliases, switch `module` to `ESNext` / `moduleResolution: Bundler`. This will break CommonJS `require` imports — rewrite them to ESM.
6. **Run `npx eslint . --fix`** — auto-fix what it can. Expect errors for:
   - `any` usage (must be typed)
   - Unused vars
   - Files over 300 lines (split them)
   - Functions over 80 lines
7. **Restructure `src/` into vertical slices:**
   ```
   src/
     features/
       delivery/          (from delivery.ts, jsonlWatcher.ts)
       discovery/         (from discovery.ts)
       attachments/       (from attachments.ts)
       persistence/       (from persistence.ts)
     shared/
       logger/            (from logger.ts)
       types/             (from types.ts)
     app/
       server.ts          (from index.ts — Fastify bootstrap)
   ```
   Each feature gets its own `index.ts` public surface.
8. **Split `src/index.ts`** — Fastify route registration into feature-local route files; feature `index.ts` exports a `registerRoutes(fastify)` function; `app/server.ts` composes them.
9. **Enable ESLint in pre-commit** — update `.lintstagedrc.json` as in section 1.12.
10. **Dry-run a commit** — verify hooks fire, commitlint enforces scope.
11. **Add GitHub Actions CI** (if repo is pushed to GitHub).

**Effort estimate:** substantial — on the order of a full day of focused coder work. The bulk of the cost is the vertical-slice restructure and ESM migration. Type strict flags already mostly match, so the TS flag migration is minor. Propose a phased approach:
- **Phase 1 (quick — hours):** add tooling (ESLint, Prettier, husky, commitlint). No restructure yet. This prevents future drift.
- **Phase 2 (bigger — day):** restructure into vertical slices + split oversized files.
- **Phase 3 (small — hours):** ESM + tsconfig flag alignment.

### 9.2 `productivitesse` (`~/environment/projects/productivitesse/`)

**Current state:**
- React Router v7 + Electron + Capacitor
- `package.json` already has `"type": "module"`, vitest 4.1, TS 5.7 — good
- Already has `eslint-plugin-boundaries` installed — **good**, matches this standard (we use `boundaries` for per-feature isolation and `import-x/no-restricted-paths` for layer boundaries)
- **Already follows vertical slice:** `src/features/` with `dashboard/`, `mobile/`, `runner/`, `recording-panel/`. Has `src/shared/`, `src/domain/`, `src/data/`. Has `src/platform/` (adapters — rename to `src/data/platform/` per the standard, or grant an exception).
- `src/transport/` is non-standard — should move under `src/data/transport/`.
- Lint script exists (`eslint app src electron --ext .ts,.tsx`) but no flat config detected in project root
- **No husky, no lint-staged, no commitlint observed** — commits are unenforced
- File sizes: many components in `src/features/dashboard/components/` — likely some exceed 300 lines (`DashboardView.tsx`, `ResponsiveApp.tsx` suspect)
- Route files under `app/routes/` are framework-required default exports — covered by the route-file ESLint override in section 3

**Migration steps:**

1. **Audit file sizes:** `find src app electron -name '*.ts*' -exec wc -l {} + | sort -rn | head -30`. Every file > 300 lines gets a split task.
2. **Move `src/transport/` under `src/data/transport/`** (or document the exception in project CLAUDE.md).
3. **Move `src/platform/` under `src/data/platform/`** (matches the standard — platform adapters are data-layer).
4. **Align `eslint-plugin-boundaries` element definitions** with section 3 (feature/shared/domain/data/app types and the allow/disallow rules). Keep the plugin — replace the project's custom rules with the standard ones.
5. **Add flat `eslint.config.js`** — copy from section 3 verbatim.
6. **Add Prettier, husky, lint-staged, commitlint** — copy configs from section 1.
7. **Update `tsconfig.json`** — verify all flags from section 2 are present. Add `verbatimModuleSyntax`, `isolatedModules`, `noFallthroughCasesInSwitch`, `noImplicitReturns` if missing.
8. **Define `commit-scopes.json`** with project-specific scopes: `dashboard`, `mobile`, `recording-panel`, `runner`, `platform`, `electron`, `capacitor`, `native`, `shared`, `domain`, `data`, `app`, `ci`, `deps`, `build`, `config`.
9. **Run `npx eslint . --fix`** — fix what's auto-fixable, open a feature branch per batch of files that need manual splits.
10. **Split oversized files** — one PR per file, each becomes a mini-task. Priority: the largest first.
11. **Run `npm run verify`** — must pass before merging into dev.

**Effort estimate:** smaller than message-relay because the vertical slice already exists. Main work: tooling install (~1 hour), transport/platform moves (~1 hour), file splits (variable — depends on how many files > 300 lines). Phase 1 = tooling; Phase 2 = file splits; Phase 3 = lint rule cleanup.

### 9.3 `knowledge-base` (future project)

**Current state:** does not exist yet on disk. (`~/environment/knowledge/` contains markdown only.)

**Migration path:** none — bootstrap it fresh using the script in section 10. It gets the full standard from day one. This is the ideal case.

---

## 10. Bootstrap Script for New Projects

File: `~/environment/scripts/bootstrap-project.sh`

This script creates a production-ready project skeleton in one command. It is self-contained — configs are inlined so nothing depends on a network fetch.

```bash
#!/usr/bin/env bash
# bootstrap-project.sh — create a new project conforming to ~/environment/CODING-STANDARDS.md
# Usage: bootstrap-project.sh <project-name> [target-dir]
set -euo pipefail

NAME="${1:-}"
TARGET_DIR="${2:-$HOME/environment/projects/$NAME}"

if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <project-name> [target-dir]" >&2
  exit 1
fi

if [[ -e "$TARGET_DIR" ]]; then
  echo "ERROR: $TARGET_DIR already exists" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

echo "==> Creating directory skeleton"
mkdir -p src/{features,shared/{components,hooks,utils,types},domain/{schemas,services},data,app}
mkdir -p test .husky .github/workflows

echo "==> Writing .gitignore"
cat > .gitignore <<'EOF'
node_modules
dist
build
coverage
.DS_Store
*.log
.env
.env.local
.vite
.cache
EOF

echo "==> Writing package.json"
cat > package.json <<EOF
{
  "name": "$NAME",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.11.0" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepare": "husky",
    "verify": "npm run typecheck && npm run lint && npm run test"
  }
}
EOF

echo "==> Writing tsconfig.json"
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@features/*": ["src/features/*"],
      "@shared/*":   ["src/shared/*"],
      "@domain/*":   ["src/domain/*"],
      "@data/*":     ["src/data/*"],
      "@app/*":      ["src/app/*"],
      "@test/*":     ["test/*"]
    }
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist", "build"]
}
EOF

cat > tsconfig.eslint.json <<'EOF'
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*", "test/**/*", "*.config.ts", "*.config.js"],
  "exclude": ["node_modules", "dist"]
}
EOF

echo "==> Writing .prettierrc"
cat > .prettierrc <<'EOF'
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
EOF

cat > .prettierignore <<'EOF'
dist
build
coverage
node_modules
*.min.js
EOF

echo "==> Writing .editorconfig"
cat > .editorconfig <<'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
EOF

echo "==> Writing .lintstagedrc.json"
cat > .lintstagedrc.json <<'EOF'
{
  "*.{ts,tsx}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
    "bash -c 'tsc --noEmit -p tsconfig.json'",
    "vitest related --run --passWithNoTests"
  ],
  "*.{js,jsx,json,md,yml,yaml}": [
    "prettier --write"
  ]
}
EOF

echo "==> Writing commit-scopes.json"
cat > commit-scopes.json <<'EOF'
{
  "scopes": ["core", "shared", "domain", "data", "app", "ci", "deps", "build", "config"],
  "note": "Add feature-specific scopes as features are added. Scopes must be kebab-case."
}
EOF

echo "==> Writing commitlint.config.js"
cat > commitlint.config.js <<'EOF'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scopes = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'commit-scopes.json'), 'utf8'),
).scopes;

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'style', 'revert']],
    'scope-enum': [2, 'always', scopes],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', ['lower-case', 'sentence-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 100],
  },
};
EOF

echo "==> Writing eslint.config.js"
# Reference the canonical config in CODING-STANDARDS.md section 3. Inlined here:
cat > eslint.config.js <<'EOF'
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import boundaries from 'eslint-plugin-boundaries';
import unicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
  { ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**', '*.config.js', '*.config.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'import-x': importX, boundaries, unicorn },
    settings: {
      'import-x/resolver': { typescript: { project: './tsconfig.eslint.json' } },
      'boundaries/elements': [
        { type: 'feature', pattern: 'src/features/*', mode: 'folder', capture: ['featureName'] },
        { type: 'shared',  pattern: 'src/shared/**/*' },
        { type: 'domain',  pattern: 'src/domain/**/*' },
        { type: 'data',    pattern: 'src/data/**/*' },
        { type: 'app',     pattern: 'src/app/**/*' },
      ],
      'boundaries/include': ['src/**/*'],
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/strict-boolean-expressions': ['warn', { allowString: false, allowNumber: false, allowNullableObject: false }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
      complexity: ['error', 15],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      'max-nested-callbacks': ['error', 3],
      'import-x/no-default-export': 'error',
      'import-x/no-cycle': ['error', { maxDepth: 10 }],
      'import-x/no-self-import': 'error',
      'import-x/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@features/**', group: 'internal', position: 'after' },
          { pattern: '@shared/**',   group: 'internal', position: 'after' },
          { pattern: '@domain/**',   group: 'internal', position: 'after' },
          { pattern: '@data/**',     group: 'internal', position: 'after' },
          { pattern: '@app/**',      group: 'internal', position: 'after' },
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],
      'import-x/no-restricted-paths': ['error', {
        zones: [
          { target: './src/shared',  from: './src/features' },
          { target: './src/shared',  from: './src/app' },
          { target: './src/domain',  from: './src/features' },
          { target: './src/domain',  from: './src/shared' },
          { target: './src/domain',  from: './src/data' },
          { target: './src/domain',  from: './src/app' },
          { target: './src/data',    from: './src/features' },
          { target: './src/data',    from: './src/app' },
          { target: './src/features', from: './src/app' },
        ],
      }],
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'feature', allow: [['feature', { featureName: '${from.featureName}' }], 'shared', 'domain', 'data'] },
          { from: 'shared',  allow: ['shared', 'domain', 'data'] },
          { from: 'domain',  allow: ['domain'] },
          { from: 'data',    allow: ['data', 'domain'] },
          { from: 'app',     allow: ['feature', 'shared', 'domain', 'data', 'app'] },
        ],
      }],
      'boundaries/external': ['error', { default: 'allow' }],
      'boundaries/no-private': ['error', { allowUncles: false }],
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-param-reassign': 'error',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': ['error', { max: 500 }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
EOF

echo "==> Writing vitest.config.ts"
cat > vitest.config.ts <<'EOF'
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared':   fileURLToPath(new URL('./src/shared',   import.meta.url)),
      '@domain':   fileURLToPath(new URL('./src/domain',   import.meta.url)),
      '@data':     fileURLToPath(new URL('./src/data',     import.meta.url)),
      '@app':      fileURLToPath(new URL('./src/app',      import.meta.url)),
      '@test':     fileURLToPath(new URL('./test',         import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/index.ts'],
    },
  },
});
EOF

echo "==> Writing CLAUDE.md"
cat > CLAUDE.md <<EOF
# $NAME

**Follows cross-project standards:** \`~/environment/CODING-STANDARDS.md\` (canonical).

This file contains project-specific rules only. System-wide rules are in CODING-STANDARDS.md
and enforced by tooling.

## Project-specific sections
- Branch policy: TBD
- Build/deploy commands: TBD
- Tech stack: TBD
EOF

echo "==> Writing README.md"
cat > README.md <<EOF
# $NAME

Bootstrapped with \`~/environment/scripts/bootstrap-project.sh\`.

## Development
\`\`\`bash
npm install
npm run verify   # typecheck + lint + test
\`\`\`

Follows cross-project standards: \`~/environment/CODING-STANDARDS.md\`
EOF

echo "==> Writing husky hooks"
cat > .husky/pre-commit <<'EOF'
#!/usr/bin/env sh
npx lint-staged
EOF
chmod +x .husky/pre-commit

cat > .husky/commit-msg <<'EOF'
#!/usr/bin/env sh
npx commitlint --edit "$1"
EOF
chmod +x .husky/commit-msg

cat > .husky/pre-push <<'EOF'
#!/usr/bin/env sh
protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')
if [ "$current_branch" = "$protected_branch" ]; then
  remote_sha=$(git rev-parse "origin/$protected_branch" 2>/dev/null || echo "")
  local_sha=$(git rev-parse HEAD)
  if [ -n "$remote_sha" ] && ! git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
    echo "ERROR: Non-fast-forward push to $protected_branch is forbidden."
    exit 1
  fi
fi
if git log @{u}.. --format=%s 2>/dev/null | grep -Ei '^wip' >/dev/null; then
  echo "ERROR: Refusing to push commits with 'wip' subject."
  exit 1
fi
EOF
chmod +x .husky/pre-push

echo "==> Writing starter src/app/main.ts"
cat > src/app/main.ts <<'EOF'
// Composition root. Wires features together and starts the app.
export function main(): void {
  console.warn('hello from', new URL(import.meta.url).pathname);
}
EOF

echo "==> Writing starter test"
cat > src/app/main.test.ts <<'EOF'
import { describe, it, expect } from 'vitest';
import { main } from './main.js';

describe('main', () => {
  it('exists', () => {
    expect(typeof main).toBe('function');
  });
});
EOF

echo "==> Installing dependencies"
npm install --save-dev \
  "@commitlint/cli@^19.5.0" \
  "@commitlint/config-conventional@^19.5.0" \
  "@types/node@^22.9.0" \
  "@vitest/coverage-v8@^4.1.0" \
  "eslint@^9.15.0" \
  "eslint-import-resolver-typescript@^3.6.3" \
  "eslint-plugin-boundaries@^5.0.1" \
  "eslint-plugin-import-x@^4.4.0" \
  "eslint-plugin-unicorn@^56.0.0" \
  "husky@^9.1.0" \
  "lint-staged@^15.2.0" \
  "prettier@^3.3.0" \
  "typescript@^5.7.0" \
  "typescript-eslint@^8.15.0" \
  "vitest@^4.1.0"

echo "==> Initializing git + husky"
git init -q
git add -A
npx husky init >/dev/null 2>&1 || true
# husky init overwrites pre-commit — restore ours:
cat > .husky/pre-commit <<'EOF'
#!/usr/bin/env sh
npx lint-staged
EOF
chmod +x .husky/pre-commit

echo "==> Initial commit (bootstrap exception — --no-verify allowed ONCE per section 7.3)"
git add -A
git -c user.email="bootstrap@local" -c user.name="bootstrap" \
  commit -q --no-verify -m "chore(config): bootstrap project skeleton from coding standards"

echo
echo "Done. Project created at: $TARGET_DIR"
echo "Next steps:"
echo "  cd $TARGET_DIR"
echo "  npm run verify"
```

Make it executable: `chmod +x ~/environment/scripts/bootstrap-project.sh`.

Usage: `bootstrap-project.sh knowledge-base`

---

## 11. Pre-Commit Checklist for LLM Agents

Before every commit, LLM agents MUST mentally (or literally) walk this list. Pre-commit hooks enforce most of it, but self-check catches issues before tooling:

- [ ] Every changed file is ≤ 300 lines (non-blank, non-comment). If hit: split.
- [ ] No function exceeds 80 lines. If hit: extract helpers.
- [ ] No `any` types. Use `unknown` and narrow.
- [ ] No `// @ts-ignore`, no `// @ts-expect-error` without a comment explaining why.
- [ ] No cross-feature imports — each `features/X/` only imports from its own files, `shared/`, `domain/`, `data/`, or another feature's `index.ts`.
- [ ] No `import/no-restricted-paths` violations.
- [ ] File names are kebab-case (`.ts`) or PascalCase (`.tsx`).
- [ ] No new `index.ts` barrels outside feature roots.
- [ ] Commit message is `type(scope): subject` with imperative mood, ≤ 72 chars.
- [ ] Scope is in `commit-scopes.json`.
- [ ] New feature has at least one test in `__tests__/`.
- [ ] No `console.log` — use `console.warn` or `console.error`, or a proper logger.
- [ ] No floating promises — every async call is `await`-ed or explicitly `void`-ed with a comment.
- [ ] No `Co-Authored-By: Claude` trailer.
- [ ] `npm run verify` passes locally (typecheck + lint + test).

---

## 12. Exceptions and Escalation

### 12.1 When to disable a rule (rare)

An `eslint-disable` is allowed ONLY when:
1. The rule creates genuine harm to clarity (not just inconvenience).
2. The disable is scoped to one line: `// eslint-disable-next-line <rule> -- <reason>`.
3. The reason is a complete sentence explaining why this specific case is exempt.
4. The author would defend the exception in code review.

Blanket `/* eslint-disable */` at the top of a file is forbidden. Enforced by `unicorn/no-abusive-eslint-disable`.

### 12.2 When to propose changing a rule

If you find yourself disabling the same rule in multiple places, the rule is wrong for the codebase. File a proposal in `~/environment/proposals/` describing:
- The rule
- The cases where it fires inappropriately
- The proposed change (soften, narrow, or remove)
- Who owns the decision

Do NOT silently disable-and-move-on. Either propose a change or accept the rule.

### 12.3 Escalation path

- **Rule clarifications / edge cases / migration questions** → consult `researcher` (me, the author of this doc) via relay.
- **Architectural decisions** → `agentflow-expert` (cross-project coding manager).
- **Strict-policy overrides** (e.g., "we need to allow `any` in this project") → CEO approval required, written into the project CLAUDE.md with rationale.

---

## Appendix A: Quick-Reference Checklist for Team Leads Adopting This Standard

1. Read this document end-to-end (you just did).
2. Audit the project against section 9 (migration plan for existing projects).
3. Open a tracking issue: "Adopt cross-project coding standards."
4. Phase 1 — tooling: install ESLint, Prettier, husky, lint-staged, commitlint. Add configs. Ensure `npm run verify` runs even if it fails with many errors initially.
5. Phase 2 — tsconfig alignment: add missing strict flags.
6. Phase 3 — restructure into vertical slices where missing.
7. Phase 4 — split oversized files.
8. Phase 5 — enable hooks (`husky install`). From this point, all new code must pass.

## Appendix B: Why These Specific Caps? (300 lines, 80 lines per function, complexity 15)

- **300 lines per file:** matches empirical LLM context-window efficiency. Claude reads ~300 lines in ~1-2k tokens; larger files force partial reads and context fragmentation. Industry precedent: Google JS style guide also caps at ~300.
- **80 lines per function:** the classic "one screen" rule. A function you cannot see entirely on one screen is a function you cannot reason about. LLMs agree.
- **Complexity 15:** cyclomatic complexity past 15 is the industry threshold where bug density rises sharply (McCabe). 10 is stricter but fights too many valid state machines; 15 is strict without being punitive.
- **Max depth 4:** past 4 nested blocks, control flow becomes invisible. Extract.
- **Max params 5:** past 5, arguments get shuffled. Use an options object.

These caps are not negotiable on a per-project basis. They are negotiable on a per-standard basis (via a formal proposal). Consistency across projects is worth more than local convenience.

---

**End of document.** For questions, consult `researcher` or `agentflow-expert` via relay.
