import { describe, test, expect } from 'bun:test'
import { isCancelCommand } from './cancelUtils.ts'

describe('isCancelCommand', () => {
  // ── Should cancel ─────────────────────────────────────────────────────────

  test('plain "cancel cancel" returns true', () => {
    expect(isCancelCommand('cancel cancel')).toBe(true)
  })

  test('"cancel cancel cancel" returns true', () => {
    expect(isCancelCommand('cancel cancel cancel')).toBe(true)
  })

  test('comma-separated "cancel, cancel" returns true', () => {
    expect(isCancelCommand('cancel, cancel')).toBe(true)
  })

  test('em-dash separated "cancel—cancel" returns true', () => {
    expect(isCancelCommand('cancel—cancel')).toBe(true)
  })

  test('trailing punctuation "cancel. cancel." returns true', () => {
    expect(isCancelCommand('cancel. cancel.')).toBe(true)
  })

  test('mixed case "Cancel CANCEL" returns true', () => {
    expect(isCancelCommand('Cancel CANCEL')).toBe(true)
  })

  test('words between cancels still detected in last 10', () => {
    expect(isCancelCommand('send message to atlas cancel do not send cancel')).toBe(true)
  })

  test('cancels near end of longer transcript', () => {
    const t =
      'Hey Jarvis route this to command please tell them the meeting is tomorrow at noon cancel cancel'
    expect(isCancelCommand(t)).toBe(true)
  })

  // ── Should NOT cancel ──────────────────────────────────────────────────────

  test('single "cancel" returns false', () => {
    expect(isCancelCommand('please cancel that')).toBe(false)
  })

  test('empty string returns false', () => {
    expect(isCancelCommand('')).toBe(false)
  })

  test('unrelated transcript returns false', () => {
    expect(isCancelCommand('send this to command please')).toBe(false)
  })

  test('"cancelcancelcancel" (merged, no separator) returns false', () => {
    // Merged token should NOT trigger — word boundary won't match
    expect(isCancelCommand('cancelcancelcancel')).toBe(false)
  })

  test('two cancels buried beyond last 10 words returns false', () => {
    // cancels are in words 1-2, transcript is 12 words total → outside last 10
    const t = 'cancel cancel one two three four five six seven eight nine ten'
    expect(isCancelCommand(t)).toBe(false)
  })
})
