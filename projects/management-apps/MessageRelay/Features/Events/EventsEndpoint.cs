using System.Text.Json.Serialization;
using MessageRelay.Jsonl;
using MessageRelay.Wire;

namespace MessageRelay.Features.Events;

/// <summary>
/// GET /events/{agent}?limit=N — parsed JSONL events for the CEO app's live
/// feed backfill. Returns the same event shapes broadcast over <c>/dashboard</c>
/// WebSocket so the client can backfill on connect with a single fetch.
/// Mirrors <c>GET /events/:agent</c> in <c>routes/messages.ts</c>.
/// Shape: <c>{ agentName, events: [{ type, data }] }</c>.
/// </summary>
internal static class EventsEndpoint
{
    private const int DefaultLimit = 300;
    private const int MaxLimit = 2000;

    public static IEndpointRouteBuilder MapEventsFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/events/{agent}", HandleAsync);
        return app;
    }

    private static async Task<IResult> HandleAsync(string agent, int? limit, CancellationToken cancellationToken)
    {
        if (!AgentName.IsValid(agent))
        {
            return Results.BadRequest(new { error = "Invalid agent name" });
        }

        int effectiveLimit = limit is > 0 ? Math.Min(limit.Value, MaxLimit) : DefaultLimit;

        IReadOnlyList<SessionFinder.SessionFile> sessions =
            await SessionFinder.FindForAgentAsync(agent, cancellationToken, daysBack: 7).ConfigureAwait(false);

        if (sessions.Count == 0)
        {
            return Results.Json(new EventsResponse(agent, []));
        }

        SessionFinder.SessionFile latest = sessions[0];
        string sessionId = Path.GetFileNameWithoutExtension(latest.Path) ?? string.Empty;

        List<JsonEvent> collected = [];
        await EventParser.ParseAsync(latest.Path, sessionId, effectiveLimit, ev =>
        {
            Dictionary<string, object?> data = new(ev.Data, StringComparer.Ordinal)
            {
                ["agentName"] = agent,
            };
            collected.Add(new JsonEvent(ev.Type, data));
        }, cancellationToken).ConfigureAwait(false);

        return Results.Json(new EventsResponse(agent, [.. collected]));
    }

    private sealed record JsonEvent(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("data")] IReadOnlyDictionary<string, object?> Data);

    private sealed record EventsResponse(
        [property: JsonPropertyName("agentName")] string AgentName,
        [property: JsonPropertyName("events")] JsonEvent[] Events);
}
