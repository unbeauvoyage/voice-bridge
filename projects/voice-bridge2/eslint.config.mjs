import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '**/.claude/worktrees/**',
      // OpenAPI codegen output — generated, not hand-maintained
      'src/data/apiClient/**/*.gen.ts',
      'src/data/apiClient/client/**',
      'src/data/apiClient/core/**',
      // daemon/ — Python subprocess scripts, JXA macOS automation, and .venv packages.
      // These are not part of the TypeScript app; linting them is noise.
      'daemon/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  // CEO LAW 2.0 — type hardening enforcement
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/ban-ts-comment': 'error'
    }
  },
  // F1-F7 feature-first boundary rules
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'page', pattern: 'src/renderer/src/pages/**' },
        { type: 'feature', pattern: 'src/renderer/src/features/*', capture: ['featureName'] },
        { type: 'feature-components', pattern: 'src/renderer/src/features/*/components/**' },
        { type: 'feature-hooks', pattern: 'src/renderer/src/features/*/hooks/**' },
        { type: 'feature-domain', pattern: 'src/renderer/src/features/*/domain/**' },
        { type: 'feature-store', pattern: 'src/renderer/src/features/*/store/**' },
        { type: 'shared', pattern: 'src/renderer/src/shared/**' }
      ]
    },
    rules: {
      // F2 — features expose only via index.ts
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/*/*', '!**/features/*/index', '!**/features/*/index.ts'],
              message:
                'Features expose their public API via index.ts. Import from features/X, never from internals.'
            }
          ]
        }
      ],
      // F5 — layer rules within a feature
      // Note: 'boundaries/dependencies' is the v6 rename of 'boundaries/element-types'.
      // Both 'from' and 'allow' use v6 object selector syntax to silence legacy selector warnings.
      'boundaries/dependencies': [
        'warn',
        {
          default: 'disallow',
          rules: [
            // pages may import feature public APIs and shared
            {
              from: [{ type: 'page' }],
              allow: [{ to: { type: 'feature' } }, { to: { type: 'shared' } }]
            },
            // feature components may use hooks, store, domain, shared
            {
              from: [{ type: 'feature-components' }],
              allow: [
                { to: { type: 'feature-hooks' } },
                { to: { type: 'feature-store' } },
                { to: { type: 'feature-domain' } },
                { to: { type: 'shared' } }
              ]
            },
            // hooks may import data and domain
            {
              from: [{ type: 'feature-hooks' }],
              allow: [{ to: { type: 'feature-domain' } }, { to: { type: 'shared' } }]
            },
            // domain is pure — imports nothing app-specific
            {
              from: [{ type: 'feature-domain' }],
              allow: []
            },
            // store may import domain for types only
            {
              from: [{ type: 'feature-store' }],
              allow: [{ to: { type: 'feature-domain' } }]
            },
            // shared imports nothing from features
            {
              from: [{ type: 'shared' }],
              allow: [{ to: { type: 'shared' } }]
            }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
