using System.Diagnostics.CodeAnalysis;
using System.Net.Http.Headers;

namespace VoiceBridge.Features.Compose.Clients;

/// <summary>
/// HTTP client for whisper-server (whisper.cpp). Posts <c>multipart/form-data</c>
/// with fields {file, response_format=text, language=auto, no_context=1} —
/// matches voice-bridge2/server/compose/clients/WhisperClient.ts's contract.
/// <para/>
/// Q3 directive: WHISPER_SKIP_CONVERT=1 default — we send the raw audio bytes
/// untouched. whisper.cpp natively accepts wav/webm/ogg/m4a, and the
/// container probe + ffmpeg shell-out in the TS sibling proved fragile
/// without buying us anything.
/// <para/>
/// The injected <see cref="HttpClient"/> carries a <c>BaseAddress</c> wired
/// from the WHISPER_URL env var (see <c>VoiceBridge/Program.cs</c>).
/// </summary>
[SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "Instantiated via DI (AddHttpClient<IWhisperClient, WhisperClient>).")]
internal sealed partial class WhisperClient : IWhisperClient
{
    private readonly HttpClient http;
    private readonly ILogger<WhisperClient> logger;

    public WhisperClient(HttpClient http, ILogger<WhisperClient> logger)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(logger);

        this.http = http;
        this.logger = logger;
    }

    public async Task<string> TranscribeAsync(
        Stream audio,
        string mime,
        string filename,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(audio);
        ArgumentNullException.ThrowIfNull(mime);
        ArgumentNullException.ThrowIfNull(filename);

        using MultipartFormDataContent form = [];
        using StreamContent file = new(audio);
        using StringContent responseFormat = new("text");
        using StringContent language = new("auto");
        using StringContent noContext = new("1");

        file.Headers.ContentType = MediaTypeHeaderValue.Parse(mime);
        form.Add(file, "file", filename);
        form.Add(responseFormat, "response_format");
        form.Add(language, "language");
        form.Add(noContext, "no_context");

        try
        {
            using HttpResponseMessage response = await http.PostAsync(
                new Uri("/inference", UriKind.Relative),
                form,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                LogWhisperFailure(logger, (int)response.StatusCode);
                throw new ComposeException(
                    ComposeErrorCode.WhisperUnavailable,
                    ComposeStage.Transcribe,
                    $"whisper returned {(int)response.StatusCode}");
            }

            return await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            LogWhisperTransportFailure(logger, ex);
            throw new ComposeException(
                ComposeErrorCode.WhisperUnavailable,
                ComposeStage.Transcribe,
                "whisper request failed",
                ex);
        }
    }

    [LoggerMessage(EventId = 1001, Level = LogLevel.Warning, Message = "Whisper returned non-2xx status {StatusCode}")]
    private static partial void LogWhisperFailure(ILogger logger, int statusCode);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Warning, Message = "Whisper request transport failure")]
    private static partial void LogWhisperTransportFailure(ILogger logger, Exception exception);
}
