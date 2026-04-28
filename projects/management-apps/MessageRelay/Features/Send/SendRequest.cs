using System.Text.Json.Serialization;

namespace MessageRelay.Features.Send;

/// <summary>
/// Spec: <c>components.schemas.SendRequest</c>. <c>type</c> is optional and
/// defaults to <c>"message"</c>; the handler resolves the default.
/// </summary>
internal sealed record SendRequest(
    [property: JsonPropertyName("from")] string From,
    [property: JsonPropertyName("to")] string To,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("type")] string? Type = null);
