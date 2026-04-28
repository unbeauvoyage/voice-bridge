using System.Text.Json;
using System.Text.Json.Serialization;
using MessageRelay.Jsonl;
using MessageRelay.Wire;

namespace MessageRelay.Features.Raw;

/// <summary>
/// GET /raw/{agent}?limit=N — last N raw JSONL records from the agent's
/// most recent session file. Used by the CEO app's "Raw JSONL" diagnostic view.
/// Mirrors <c>GET /raw/:agent</c> in <c>routes/messages.ts</c>.
/// </summary>
internal static class RawEndpoint
{
    private const int DefaultLimit = 200;
    private const int MaxLimit = 1000;

    public static IEndpointRouteBuilder MapRawFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/raw/{agent}", HandleAsync);
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
            return Results.Json(new RawResponse(null, null, []));
        }

        SessionFinder.SessionFile latest = sessions[0];
        string? sessionId = Path.GetFileNameWithoutExtension(latest.Path);

        string raw;
        try
        {
            raw = await File.ReadAllTextAsync(latest.Path, cancellationToken).ConfigureAwait(false);
        }
        catch (IOException)
        {
            return Results.Json(new RawResponse(null, null, []));
        }

        string[] lines = raw.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        IEnumerable<string> recent = lines.Length > effectiveLimit
            ? lines[^effectiveLimit..]
            : lines;

        List<JsonElement> records = [];
        foreach (string line in recent)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            try
            {
                JsonDocument doc = JsonDocument.Parse(line.Trim());
                records.Add(doc.RootElement.Clone());
            }
            catch (JsonException) { }
        }

        return Results.Json(new RawResponse(sessionId, latest.Path, [.. records]));
    }

    private sealed record RawResponse(
        [property: JsonPropertyName("sessionId")] string? SessionId,
        [property: JsonPropertyName("path")] string? Path,
        [property: JsonPropertyName("records")] JsonElement[] Records);
}
