using System.Text.Json.Serialization;

namespace MessageRelay.Features.Send;

/// <summary>
/// Spec: <c>components.schemas.SendResponse</c>. The <c>error</c> field is
/// only present on <c>status == "failed"</c>; <c>WhenWritingNull</c> in the
/// repo-wide <c>JsonOptions</c> elides it for delivered/queued responses.
/// </summary>
internal sealed record SendResponse(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("error")] string? Error = null);
