using System.Diagnostics.CodeAnalysis;
using System.Text.Json.Serialization;

namespace VoiceBridge.Features.Compose.Clients;

/// <summary>
/// HTTP client for message-relay's <c>POST /send</c>. JSON body
/// {from, to, body, type}; 2xx response carries {id, status}.
/// </summary>
[SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "Instantiated via DI (AddHttpClient<IRelaySendClient, RelaySendClient>).")]
internal sealed partial class RelaySendClient : IRelaySendClient
{
    private readonly HttpClient http;
    private readonly ILogger<RelaySendClient> logger;

    public RelaySendClient(HttpClient http, ILogger<RelaySendClient> logger)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(logger);

        this.http = http;
        this.logger = logger;
    }

    public async Task<RelaySendResult> SendAsync(
        string from,
        string to,
        string body,
        string messageType,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(from);
        ArgumentNullException.ThrowIfNull(to);
        ArgumentNullException.ThrowIfNull(body);
        ArgumentNullException.ThrowIfNull(messageType);

        SendRequest request = new(from, to, body, messageType);

        try
        {
            using HttpResponseMessage response = await http.PostAsJsonAsync(
                new Uri("/send", UriKind.Relative),
                request,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                LogRelayFailure(logger, (int)response.StatusCode);
                throw new ComposeException(
                    ComposeErrorCode.RelayUnavailable,
                    ComposeStage.Deliver,
                    $"relay returned {(int)response.StatusCode}");
            }

            SendResponse? sendResponse = await response.Content.ReadFromJsonAsync<SendResponse>(cancellationToken);
            if (sendResponse is null)
            {
                throw new ComposeException(
                    ComposeErrorCode.RelayUnavailable,
                    ComposeStage.Deliver,
                    "relay returned empty body");
            }

            return new RelaySendResult(sendResponse.Id, sendResponse.Status);
        }
        catch (HttpRequestException ex)
        {
            LogRelayTransportFailure(logger, ex);
            throw new ComposeException(
                ComposeErrorCode.RelayUnavailable,
                ComposeStage.Deliver,
                "relay request failed",
                ex);
        }
    }

    [LoggerMessage(EventId = 1201, Level = LogLevel.Warning, Message = "Relay returned non-2xx status {StatusCode}")]
    private static partial void LogRelayFailure(ILogger logger, int statusCode);

    [LoggerMessage(EventId = 1202, Level = LogLevel.Warning, Message = "Relay request transport failure")]
    private static partial void LogRelayTransportFailure(ILogger logger, Exception exception);

    [SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "Instantiated and serialized by System.Text.Json.")]
    private sealed record SendRequest(
        [property: JsonPropertyName("from")] string From,
        [property: JsonPropertyName("to")] string To,
        [property: JsonPropertyName("body")] string Body,
        [property: JsonPropertyName("type")] string Type);

    [SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "Instantiated by System.Text.Json deserializer.")]
    private sealed record SendResponse(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("status")] string Status);
}
