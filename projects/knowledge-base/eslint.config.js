import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

// Aligned to voice-bridge2 convergence baseline (2026-04-15).
// eslint-plugin-boundaries not added: KB has no features/ directory structure.
// Baseline: 127 warnings, 0 errors (documented in task #50).

const strictTypeRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true, allowHigherOrderFunctions: true }],
  '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
  '@typescript-eslint/ban-ts-comment': 'error',
};

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint, import: importPlugin },
    rules: {
      ...strictTypeRules,
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    // CLI tool and logger — console output is the intended interface
    files: ['src/index.ts', 'src/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // web/api.ts is the boundary layer — intentionally imports from src/, needs TS parser
    files: ['web/api.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...strictTypeRules,
    },
  },
  {
    // Web/UI layer — must not import from src/ directly (use web/api.ts as boundary)
    files: ['web/**/*.ts', 'web/**/*.tsx'],
    ignores: ['web/api.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks, import: importPlugin },
    rules: {
      ...strictTypeRules,
      // React component return types are inferred from JSX — demote to warn for the UI layer
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true, allowHigherOrderFunctions: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Architecture rule: web/ must only talk to backend via web/api.ts
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['../src/*', '../../src/*'],
          message: 'Web layer must not import from src/ directly. Use web/api.ts as the boundary.',
        }],
      }],
    },
  },
  {
    // Test files (must come LAST to override src/**/*.ts rules for matching files)
    // Relax assertion rules for test helpers and JSON response typing
    files: ['src/**/*.test.ts', 'src/db/**/*.test.ts', 'tests/**/*.spec.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true, allowHigherOrderFunctions: true }],
      // Tests use `as SomeType` to type JSON responses — acceptable in test code
      '@typescript-eslint/consistent-type-assertions': ['warn', { assertionStyle: 'as' }],
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-console': 'off',
    },
  },
];
