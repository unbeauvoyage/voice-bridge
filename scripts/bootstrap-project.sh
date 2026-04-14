#!/usr/bin/env bash
# bootstrap-project.sh — create a new project conforming to ~/environment/CODING-STANDARDS.md
# Canonical reference: ~/environment/CODING-STANDARDS.md section 10
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
cat > .husky/pre-commit <<'EOF'
#!/usr/bin/env sh
npx lint-staged
EOF
chmod +x .husky/pre-commit

echo "==> Initial commit (bootstrap exception — --no-verify allowed ONCE per CODING-STANDARDS.md section 7.3)"
git add -A
git -c user.email="bootstrap@local" -c user.name="bootstrap" \
  commit -q --no-verify -m "chore(config): bootstrap project skeleton from coding standards"

echo
echo "Done. Project created at: $TARGET_DIR"
echo "Next steps:"
echo "  cd $TARGET_DIR"
echo "  npm run verify"
