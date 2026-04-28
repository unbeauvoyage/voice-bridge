namespace VoiceBridge.Features.Compose;

/// <summary>
/// Machine-readable error codes for the <c>error</c> field of a /compose
/// failure response. Wire literals via
/// <see cref="ComposeErrorCodeExtensions.ToWire"/> (snake_case to match
/// voice-bridge2/server/compose/envelope.ts).
/// </summary>
internal enum ComposeErrorCode
{
    ValidationFailed,
    NoSpeech,
    AttachmentTooLarge,
    UnsupportedMime,
    WhisperUnavailable,
    ContentServiceUnavailable,
    RelayUnavailable,
}
