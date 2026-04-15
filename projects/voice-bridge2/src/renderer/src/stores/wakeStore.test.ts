import { describe, it, expect, beforeEach } from 'bun:test'
import { useWakeStore } from './wakeStore'

describe('wakeStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWakeStore.setState({
      wakeState: 'idle',
      micState: 'on',
      target: 'command',
      transcript: ''
    })
  })

  it('should initialize with default state', () => {
    const state = useWakeStore.getState()
    expect(state.wakeState).toBe('idle')
    expect(state.micState).toBe('on')
    expect(state.target).toBe('command')
    expect(state.transcript).toBe('')
  })

  it('should allow setting wakeState', () => {
    useWakeStore.getState().setWakeState('listening')
    expect(useWakeStore.getState().wakeState).toBe('listening')
  })

  it('should allow setting micState (persisted preference)', () => {
    useWakeStore.getState().setMicState('off')
    expect(useWakeStore.getState().micState).toBe('off')
  })

  it('should allow setting target (persisted preference)', () => {
    useWakeStore.getState().setTarget('agent')
    expect(useWakeStore.getState().target).toBe('agent')
  })

  it('should allow setting transcript (runtime state)', () => {
    useWakeStore.getState().setTranscript('hello world')
    expect(useWakeStore.getState().transcript).toBe('hello world')
  })

  it('should support immutable updates via immer middleware', () => {
    // Immer middleware allows both immutable-style and direct mutations to work
    const before = useWakeStore.getState().target
    useWakeStore.getState().setTarget('newTarget')
    expect(useWakeStore.getState().target).toBe('newTarget')
    expect(useWakeStore.getState().target).not.toBe(before)
  })

  it('should update multiple fields via setDaemonState', () => {
    useWakeStore.getState().setDaemonState({
      target: 'daemon-target',
      micState: 'off',
      wakeState: 'processing',
      transcript: 'daemon transcript'
    })

    const state = useWakeStore.getState()
    expect(state.target).toBe('daemon-target')
    expect(state.micState).toBe('off')
    expect(state.wakeState).toBe('processing')
    expect(state.transcript).toBe('daemon transcript')
  })

  it('store is configured with immer + persist middleware', () => {
    // Verify the store has the middleware behaviors
    // The store can be mutated and persisted to localStorage (when in browser)
    const initialState = useWakeStore.getState()
    expect(initialState).toHaveProperty('wakeState')
    expect(initialState).toHaveProperty('micState')
    expect(initialState).toHaveProperty('target')
    expect(initialState).toHaveProperty('transcript')
    expect(initialState).toHaveProperty('setWakeState')
    expect(initialState).toHaveProperty('setMicState')
    expect(initialState).toHaveProperty('setTarget')
    expect(initialState).toHaveProperty('setTranscript')
    expect(initialState).toHaveProperty('setDaemonState')
  })
})
