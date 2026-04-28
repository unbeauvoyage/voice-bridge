namespace VoiceBridge.Features.Compose;

/// <summary>
/// 4xx/5xx error shape per voice-bridge2/docs/openapi.yaml. <c>error</c> is
/// the machine-readable code (see <see cref="ComposeErrorCode"/>); <c>stage</c>
/// is the orchestration phase that failed (see <see cref="ComposeStage"/>);
/// <c>message</c> is a human-readable hint.
/// </summary>
internal sealed record ComposeError(string Error, string? Message, string? Stage);
