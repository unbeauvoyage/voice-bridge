using System.Text.Json.Serialization;

namespace MessageRelay.Wire;

/// <summary>
/// Spec: <c>components.schemas.StoredMessage</c>. Wire shape pushed inside
/// <c>DashboardMessageFrame.data</c> on the <c>/dashboard</c> WebSocket and
/// returned by <c>GET /history/{agent}</c> (future).
/// </summary>
internal sealed record StoredMessage(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("from")] string From,
    [property: JsonPropertyName("to")] string To,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("ts")] string Ts,
    [property: JsonPropertyName("delivered")] bool Delivered);
