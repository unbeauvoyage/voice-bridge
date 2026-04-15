import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts']
const webFiles = ['web/**/*.{ts,tsx}']

const scopedTypeScriptRecommended = tseslint.configs.recommended.map((config) =>
  config.files ? config : { ...config, files: tsFiles }
)

const sameFeature = (type) => ({
  to: {
    type,
    captured: { featureName: '{{from.featureName}}' }
  }
})

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/.claude/worktrees/**',
      // OpenAPI codegen output — generated, not hand-maintained
      'web/src/data/apiClient/**/*.gen.ts',
      'web/src/data/apiClient/client/**',
      'web/src/data/apiClient/core/**',
      '**/generated',
      '**/*.d.ts'
    ]
  },
  ...scopedTypeScriptRecommended,
  {
    files: webFiles,
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
    files: tsFiles,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/ban-ts-comment': 'error'
    }
  },
  // Per-layer customizations
  {
    files: ['src/**/*.ts', 'web/**/*.ts', 'web/**/*.tsx'],
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    }
  },
  {
    files: ['src/index.ts', 'src/logger.ts'],
    rules: {
      'no-console': 'off',
    }
  },
  {
    // React component return types are inferred from JSX — demote to warn for the web layer
    files: ['web/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true, allowHigherOrderFunctions: true }],
    }
  },
  {
    // Test files — relax type assertions for JSON response typing
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['warn', { assertionStyle: 'as' }],
    }
  },
  // F1-F7 feature-first boundary rules with data and stores layers
  {
    files: webFiles,
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'page', pattern: 'web/src/pages/*.tsx', mode: 'file' },
        { type: 'feature-components', pattern: 'web/src/features/*/components/**', capture: ['featureName'] },
        { type: 'feature-hooks', pattern: 'web/src/features/*/hooks/**', capture: ['featureName'] },
        { type: 'feature-domain', pattern: 'web/src/features/*/domain/**', capture: ['featureName'] },
        { type: 'feature-store', pattern: 'web/src/features/*/store/**', capture: ['featureName'] },
        {
          type: 'feature',
          pattern: ['web/src/features/*/index.ts', 'web/src/features/*/index.tsx'],
          mode: 'file',
          capture: ['featureName']
        },
        { type: 'data', pattern: 'web/src/data/**' },
        { type: 'stores', pattern: 'web/src/stores/**' },
        { type: 'shared', pattern: 'web/src/shared/**' },
        { type: 'shared', pattern: 'web/src/types.ts', mode: 'file' }
      ]
    },
    rules: {
      // F2 — features expose only via index.ts
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/*/*', '!**/features/*/index', '!**/features/*/index.ts', '!**/features/*/index.tsx'],
              message:
                'Features expose their public API via index.ts. Import from features/X, never from internals.'
            }
          ]
        }
      ],
      // F5 — layer rules within a feature
      // Note: 'boundaries/dependencies' is the v6 rename of 'boundaries/element-types'.
      'boundaries/dependencies': [
        'warn',
        {
          default: 'disallow',
          rules: [
            // pages may import features, data, stores, shared
            {
              from: [{ type: 'page' }],
              allow: [{ to: { type: 'feature' } }, { to: { type: 'data' } }, { to: { type: 'stores' } }, { to: { type: 'shared' } }]
            },
            // feature public APIs may aggregate their own internals plus lower layers
            {
              from: [{ type: 'feature' }],
              allow: [
                sameFeature('feature-components'),
                sameFeature('feature-hooks'),
                sameFeature('feature-domain'),
                sameFeature('feature-store'),
                { to: { type: 'data' } },
                { to: { type: 'stores' } },
                { to: { type: 'shared' } }
              ]
            },
            // feature components may use same-feature internals, cross-feature public APIs, and lower layers
            {
              from: [{ type: 'feature-components' }],
              allow: [
                sameFeature('feature-components'),
                sameFeature('feature-hooks'),
                sameFeature('feature-store'),
                sameFeature('feature-domain'),
                { to: { type: 'feature' } },
                { to: { type: 'data' } },
                { to: { type: 'stores' } },
                { to: { type: 'shared' } }
              ]
            },
            // hooks may import same-feature hooks/domain/store, cross-feature public APIs, and lower layers
            {
              from: [{ type: 'feature-hooks' }],
              allow: [
                sameFeature('feature-hooks'),
                sameFeature('feature-domain'),
                sameFeature('feature-store'),
                { to: { type: 'feature' } },
                { to: { type: 'data' } },
                { to: { type: 'stores' } },
                { to: { type: 'shared' } }
              ]
            },
            // domain is pure inside a feature — no cross-feature or data/store imports
            {
              from: [{ type: 'feature-domain' }],
              allow: [sameFeature('feature-domain'), { to: { type: 'shared' } }]
            },
            // feature-local stores may use same-feature domain plus lower layers
            {
              from: [{ type: 'feature-store' }],
              allow: [
                sameFeature('feature-store'),
                sameFeature('feature-domain'),
                { to: { type: 'data' } },
                { to: { type: 'stores' } },
                { to: { type: 'shared' } }
              ]
            },
            // data layer can only import shared
            {
              from: [{ type: 'data' }],
              allow: [{ to: { type: 'shared' } }]
            },
            // stores can import data and shared
            {
              from: [{ type: 'stores' }],
              allow: [{ to: { type: 'data' } }, { to: { type: 'shared' } }]
            },
            // shared imports nothing from features, data, or stores
            {
              from: [{ type: 'shared' }],
              allow: [{ to: { type: 'shared' } }]
            }
          ]
        }
      ]
    }
  }
)
