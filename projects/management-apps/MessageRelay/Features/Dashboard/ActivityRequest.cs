using System.Text.Json.Serialization;

namespace MessageRelay.Features.Dashboard;

internal sealed record ActivityRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("state")] string? State,
    [property: JsonPropertyName("backend")] string? Backend,
    [property: JsonPropertyName("detail")] string? Detail,
    [property: JsonPropertyName("ts")] string? Ts);
