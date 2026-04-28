using System.Text.Json.Serialization;

namespace MessageRelay.Features.Send;

/// <summary>
/// Spec: <c>components.schemas.SendError</c>. <c>id</c> is required-but-nullable;
/// the field MUST be present on the wire even when null. The handler serializes
/// this record with a per-call <c>JsonSerializerOptions</c> that disables
/// <c>WhenWritingNull</c> so the contract survives.
/// </summary>
internal sealed record SendError(
    [property: JsonPropertyName("error")] string Error,
    [property: JsonPropertyName("id")] string? Id,
    [property: JsonPropertyName("status")] string Status);
