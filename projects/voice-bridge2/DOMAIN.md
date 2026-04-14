# voice-bridge2 Domain

This app is the voice interface. It bridges speech → intent → relay dispatch.

## Core Terms (from shared/domain)

| Term | Type | Description |
|---|---|---|
| `AgentName` | branded string | The dispatch target — selected in the settings panel. |
| `SendRequest` | interface | Sent to relay after voice transcription + routing. |
| `MessageType` | union | Always `'voice'` for voice-initiated messages. |

## Local Extensions (src/domain/, src/preload/index.ts)

| Term | Where | Description |
|---|---|---|
| `DaemonState` | `src/preload/index.ts` | Wake-word daemon state: `idle \| listening \| transcribing \| done \| error` |
| `OverlayMode` | `src/preload/index.ts` | Overlay display variant: `recording \| success \| cancelled \| error \| message \| hidden` |
| `OverlayPayload` | `src/preload/index.ts` | Overlay content sent from main to renderer over IPC. |
| `WakeWordConfig` | `server/index.ts` | Sensitivity thresholds for wake-word detection. |

## Invariants

- Only one dispatch target at a time — `AgentName` is persisted to `tmp/last-target.txt`
- Overlay always hides after 3 seconds unless mode is `recording`
- Voice messages always use `type: 'voice'` in relay dispatch
