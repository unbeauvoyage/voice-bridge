namespace VoiceBridge.Features.Compose.Clients;

/// <summary>
/// Posts a fully-composed message to message-relay's <c>/send</c> endpoint.
/// Contract per voice-bridge2/server/compose/clients/RelaySendClient.ts.
/// Throws <see cref="ComposeException"/> with code RelayUnavailable on
/// transport or non-2xx upstream failure.
/// </summary>
internal interface IRelaySendClient
{
    public Task<RelaySendResult> SendAsync(
        string from,
        string to,
        string body,
        string messageType,
        CancellationToken cancellationToken);
}
