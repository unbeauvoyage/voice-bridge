/**
 * Public API for the compose library.
 *
 * Route handlers import from here. The library is self-contained:
 * copy-paste server/compose/ into relay or .NET; only swap RelaySendClient
 * for an in-process call and remount the route handler.
 */

export { composeMessage } from './orchestrator.ts'
export type { ComposeDeps } from './orchestrator.ts'
export type {
  ComposeEnvelope,
  ComposeResult,
  ComposeSuccess,
  ComposeError,
  ComposeErrorCode,
  ComposeStage,
  ComposedAttachment
} from './envelope.ts'
export { HttpWhisperClient } from './clients/WhisperClient.ts'
export type { IWhisperClient } from './clients/WhisperClient.ts'
export {
  HttpContentServiceClient,
  TooLargeError,
  UnsupportedMimeError
} from './clients/ContentServiceClient.ts'
export type { IContentServiceClient } from './clients/ContentServiceClient.ts'
export { HttpRelaySendClient } from './clients/RelaySendClient.ts'
export type {
  IRelaySendClient,
  RelaySendParams,
  RelaySendResult
} from './clients/RelaySendClient.ts'
