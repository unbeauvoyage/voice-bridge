namespace VoiceBridge.Features.Compose;

/// <summary>
/// 200-OK response shape per voice-bridge2/docs/openapi.yaml. <c>delivered</c>
/// is always <c>true</c> — partial deliveries throw and surface as 4xx/5xx
/// <see cref="ComposeError"/>.
/// </summary>
internal sealed record ComposeResponse(
    bool Delivered,
    string To,
    string? Transcript,
    IReadOnlyList<ComposeAttachment> AttachmentUrls,
    string Body,
    string MessageId,
    string Ts);
