namespace VoiceBridge.Features.Compose;

internal static class ComposeErrorCodeExtensions
{
    public static string ToWire(this ComposeErrorCode code) =>
        code switch
        {
            ComposeErrorCode.ValidationFailed => "validation_failed",
            ComposeErrorCode.NoSpeech => "no_speech",
            ComposeErrorCode.AttachmentTooLarge => "attachment_too_large",
            ComposeErrorCode.UnsupportedMime => "unsupported_mime",
            ComposeErrorCode.WhisperUnavailable => "whisper_unavailable",
            ComposeErrorCode.ContentServiceUnavailable => "content_service_unavailable",
            ComposeErrorCode.RelayUnavailable => "relay_unavailable",
            _ => throw new ArgumentOutOfRangeException(nameof(code), code, message: null),
        };
}
