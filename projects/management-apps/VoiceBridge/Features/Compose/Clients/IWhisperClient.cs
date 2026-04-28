namespace VoiceBridge.Features.Compose.Clients;

/// <summary>
/// Transcribes a single audio blob via whisper-server. Returns the raw
/// transcript text (may be empty for silence). Throws
/// <see cref="ComposeException"/> with code WhisperUnavailable on transport
/// or non-2xx upstream failure.
/// </summary>
internal interface IWhisperClient
{
    public Task<string> TranscribeAsync(
        Stream audio,
        string mime,
        string filename,
        CancellationToken cancellationToken);
}
