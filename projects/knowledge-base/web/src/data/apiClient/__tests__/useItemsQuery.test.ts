/**
 * useItemsQuery.test.ts — Unit test for useItemsQuery Layer 1 hook
 *
 * Verifies:
 * - Hook has correct cache key
 * - Hook structure follows React Query pattern
 * - Exports are available for feature re-exports
 */
import { test, expect } from 'bun:test'
import { ITEMS_QUERY_KEY, useItemsQuery } from '../useItemsQuery.ts'

test('useItemsQuery has correct cache key', () => {
  expect(ITEMS_QUERY_KEY).toEqual(['items'])
})

test('useItemsQuery is a function', () => {
  expect(typeof useItemsQuery).toBe('function')
})

test('useItemsQuery exports are defined', () => {
  // Verifies that the hook and cache key are exported for re-export via feature index.ts
  expect(ITEMS_QUERY_KEY).toBeDefined()
  expect(useItemsQuery).toBeDefined()
})
