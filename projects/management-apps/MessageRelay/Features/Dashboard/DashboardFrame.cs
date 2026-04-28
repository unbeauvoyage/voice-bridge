using System.Text.Json.Serialization;

namespace MessageRelay.Features.Dashboard;

/// <summary>
/// Shape of every JSON frame pushed on the <c>/dashboard</c> WebSocket.
/// Spec: <c>components.schemas.DashboardMessageFrame</c> /
/// <c>DashboardActivityFrame</c> / <c>DashboardSnapshotFrame</c> — they all
/// share the discriminator pattern <c>{ type, data }</c>.
/// </summary>
internal sealed record DashboardFrame<TData>(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("data")] TData Data);
