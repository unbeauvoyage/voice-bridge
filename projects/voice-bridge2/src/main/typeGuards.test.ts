import { describe, test, expect } from 'bun:test'
import {
  isMicResponse,
  isAgentsResponse,
  isOverlayPayload,
  type OverlayPayload
} from './typeGuards.ts'

describe('isMicResponse', () => {
  test('accepts {state: "on"}', () => {
    expect(isMicResponse({ state: 'on' })).toBe(true)
  })
  test('accepts {state: "off"}', () => {
    expect(isMicResponse({ state: 'off' })).toBe(true)
  })
  test('rejects other state values', () => {
    expect(isMicResponse({ state: 'muted' })).toBe(false)
  })
  test('rejects missing state key', () => {
    expect(isMicResponse({})).toBe(false)
  })
  test('rejects null', () => {
    expect(isMicResponse(null)).toBe(false)
  })
  test('rejects primitives', () => {
    expect(isMicResponse('on')).toBe(false)
    expect(isMicResponse(42)).toBe(false)
  })
})

describe('isAgentsResponse', () => {
  test('accepts {agents: []}', () => {
    expect(isAgentsResponse({ agents: [] })).toBe(true)
  })
  test('accepts {agents: [{name}, ...]}', () => {
    expect(isAgentsResponse({ agents: [{ name: 'a' }, { name: 'b' }] })).toBe(true)
  })
  test('rejects missing agents key', () => {
    expect(isAgentsResponse({})).toBe(false)
  })
  test('rejects non-array agents', () => {
    expect(isAgentsResponse({ agents: 'a' })).toBe(false)
  })
  test('rejects null', () => {
    expect(isAgentsResponse(null)).toBe(false)
  })
})

describe('isOverlayPayload', () => {
  test('accepts each valid mode', () => {
    const modes: OverlayPayload['mode'][] = [
      'success',
      'recording',
      'cancelled',
      'error',
      'message',
      'hidden'
    ]
    for (const mode of modes) {
      expect(isOverlayPayload({ mode })).toBe(true)
    }
  })
  test('accepts mode with optional text', () => {
    expect(isOverlayPayload({ mode: 'message', text: 'hi' })).toBe(true)
  })
  test('accepts mode with text: undefined (exactOptionalPropertyTypes tolerant)', () => {
    expect(isOverlayPayload({ mode: 'message', text: undefined })).toBe(true)
  })
  test('rejects invalid mode', () => {
    expect(isOverlayPayload({ mode: 'wat' })).toBe(false)
  })
  test('rejects missing mode', () => {
    expect(isOverlayPayload({ text: 'hi' })).toBe(false)
  })
  test('rejects non-string text', () => {
    expect(isOverlayPayload({ mode: 'message', text: 42 })).toBe(false)
  })
  test('rejects null', () => {
    expect(isOverlayPayload(null)).toBe(false)
  })
})
