using System.Text.Json.Serialization;

namespace MessageRelay.Features.Dashboard;

internal sealed record ActivityFrame(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("backend")] string Backend,
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("detail")] string? Detail,
    [property: JsonPropertyName("ts")] string Ts);
