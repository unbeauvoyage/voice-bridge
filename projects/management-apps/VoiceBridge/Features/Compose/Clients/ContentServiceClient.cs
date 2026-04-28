using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json.Serialization;

namespace VoiceBridge.Features.Compose.Clients;

/// <summary>
/// HTTP client for content-service. Posts <c>multipart/form-data</c> with a
/// single <c>file</c> field to <c>/upload</c> — matches
/// voice-bridge2/server/compose/clients/ContentServiceClient.ts.
/// 200 → <see cref="ComposeAttachment"/>; 413 → AttachmentTooLarge;
/// 415 → UnsupportedMime; anything else → ContentServiceUnavailable.
/// </summary>
[SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "Instantiated via DI (AddHttpClient<IContentServiceClient, ContentServiceClient>).")]
internal sealed partial class ContentServiceClient : IContentServiceClient
{
    private readonly HttpClient http;
    private readonly ILogger<ContentServiceClient> logger;

    public ContentServiceClient(HttpClient http, ILogger<ContentServiceClient> logger)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(logger);

        this.http = http;
        this.logger = logger;
    }

    public async Task<ComposeAttachment> UploadAsync(
        Stream content,
        string mime,
        string filename,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(content);
        ArgumentNullException.ThrowIfNull(mime);
        ArgumentNullException.ThrowIfNull(filename);

        using HttpResponseMessage response = await PostMultipartAsync(content, mime, filename, cancellationToken);

        EnsureSuccessOrThrow(response, mime, filename);

        UploadResponse? body = await response.Content.ReadFromJsonAsync<UploadResponse>(cancellationToken);
        if (body is null)
        {
            throw new ComposeException(
                ComposeErrorCode.ContentServiceUnavailable,
                ComposeStage.Upload,
                "content-service returned empty body");
        }

        return new ComposeAttachment(body.Url, body.Mime, body.Bytes, body.Sha256);
    }

    private async Task<HttpResponseMessage> PostMultipartAsync(
        Stream content,
        string mime,
        string filename,
        CancellationToken cancellationToken)
    {
        using MultipartFormDataContent form = [];
        using StreamContent file = new(content);

        file.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(file, "file", filename);

        try
        {
            return await http.PostAsync(
                new Uri("/upload", UriKind.Relative),
                form,
                cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            LogContentServiceTransportFailure(logger, ex);
            throw new ComposeException(
                ComposeErrorCode.ContentServiceUnavailable,
                ComposeStage.Upload,
                "content-service request failed",
                ex);
        }
    }

    private void EnsureSuccessOrThrow(HttpResponseMessage response, string mime, string filename)
    {
        if (response.StatusCode == HttpStatusCode.RequestEntityTooLarge)
        {
            throw new ComposeException(
                ComposeErrorCode.AttachmentTooLarge,
                ComposeStage.Upload,
                $"attachment {filename} exceeds size limit");
        }

        if (response.StatusCode == HttpStatusCode.UnsupportedMediaType)
        {
            throw new ComposeException(
                ComposeErrorCode.UnsupportedMime,
                ComposeStage.Upload,
                $"attachment {filename} mime {mime} not supported");
        }

        if (!response.IsSuccessStatusCode)
        {
            LogContentServiceFailure(logger, (int)response.StatusCode);
            throw new ComposeException(
                ComposeErrorCode.ContentServiceUnavailable,
                ComposeStage.Upload,
                $"content-service returned {(int)response.StatusCode}");
        }
    }

    [LoggerMessage(EventId = 1101, Level = LogLevel.Warning, Message = "Content-service returned non-2xx status {StatusCode}")]
    private static partial void LogContentServiceFailure(ILogger logger, int statusCode);

    [LoggerMessage(EventId = 1102, Level = LogLevel.Warning, Message = "Content-service request transport failure")]
    private static partial void LogContentServiceTransportFailure(ILogger logger, Exception exception);

    [SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "Instantiated by System.Text.Json deserializer.")]
    private sealed record UploadResponse(
        [property: JsonPropertyName("url")] string Url,
        [property: JsonPropertyName("mime")] string Mime,
        [property: JsonPropertyName("bytes")] long Bytes,
        [property: JsonPropertyName("sha256")] string Sha256);
}
