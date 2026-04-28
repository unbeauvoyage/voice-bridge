using System.Text.Json.Serialization;

namespace MessageRelay.Features.Dashboard;

internal sealed record SnapshotData(
    [property: JsonPropertyName("sessions")] object[] Sessions);
