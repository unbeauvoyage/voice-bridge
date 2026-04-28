namespace VoiceBridge.Features.Compose;

/// <summary>
/// Parsed multipart payload for POST /compose. Boundary contract per
/// voice-bridge2/docs/openapi.yaml: <c>to</c> required, all others optional;
/// validation enforces "at least one of text/audio/attachments is non-empty".
/// </summary>
internal sealed record ComposeRequest(
    string To,
    string? Text,
    string? ReplyTo,
    IFormFile? Audio,
    IReadOnlyList<IFormFile> Attachments);
