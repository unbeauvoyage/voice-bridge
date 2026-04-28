using System.Text.Json.Serialization;
using MessageRelay.Jsonl;
using MessageRelay.Wire;

namespace MessageRelay.Features.History;

/// <summary>
/// GET /history/{agent}?limit=N — last N relay messages for an agent.
/// Reads Claude session JSONL files (canonical source of truth), extracting
/// both incoming channel messages and outgoing relay_reply calls.
/// Mirrors <c>GET /history/:agent</c> in <c>routes/messages.ts</c>.
/// </summary>
internal static class HistoryEndpoint
{
    private const int DefaultLimit = 200;
    private const int MaxLimit = 500;

    public static IEndpointRouteBuilder MapHistoryFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/history/{agent}", HandleAsync);
        return app;
    }

    private static async Task<IResult> HandleAsync(string agent, int? limit, CancellationToken cancellationToken)
    {
        if (!AgentName.IsValid(agent))
        {
            return Results.BadRequest(new { error = "Invalid agent name" });
        }

        int effectiveLimit = limit is > 0 ? Math.Min(limit.Value, MaxLimit) : DefaultLimit;

        IReadOnlyDictionary<string, string> sessionMap =
            await SessionFinder.BuildSessionToAgentMapAsync(cancellationToken).ConfigureAwait(false);
        HashSet<string> knownAgents = new(sessionMap.Values, StringComparer.Ordinal) { "ceo" };

        IReadOnlyList<SessionFinder.SessionFile> sessionFiles =
            await SessionFinder.FindForAgentAsync(agent, cancellationToken).ConfigureAwait(false);

        List<MessageExtractor.ExtractedMessage> all = [];
        foreach (SessionFinder.SessionFile sf in sessionFiles)
        {
            IReadOnlyList<MessageExtractor.ExtractedMessage> msgs =
                await MessageExtractor.ExtractAsync(sf.Path, agent, knownAgents, cancellationToken)
                    .ConfigureAwait(false);
            all.AddRange(msgs);
            if (all.Count >= effectiveLimit * 4)
            {
                break;
            }
        }

        HashSet<string> seen = new(StringComparer.Ordinal);
        List<MessageExtractor.ExtractedMessage> unique = all
            .Where(m =>
            {
                string key = $"{m.From}\0{m.To}\0{m.Body}\0{m.Ts[..Math.Min(16, m.Ts.Length)]}";
                return seen.Add(key);
            })
            .ToList();

        unique.Sort(static (a, b) => string.Compare(a.Ts, b.Ts, StringComparison.Ordinal));

        HistoryMessage[] messages = unique
            .TakeLast(effectiveLimit)
            .Select(static m => new HistoryMessage(m.Id, m.From, m.To, m.Body, m.Type, m.Ts, m.Delivered))
            .ToArray();

        return Results.Json(new HistoryResponse(messages));
    }

    private sealed record HistoryMessage(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("from")] string From,
        [property: JsonPropertyName("to")] string To,
        [property: JsonPropertyName("body")] string Body,
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("ts")] string Ts,
        [property: JsonPropertyName("delivered")] bool Delivered);

    private sealed record HistoryResponse([property: JsonPropertyName("messages")] HistoryMessage[] Messages);
}
