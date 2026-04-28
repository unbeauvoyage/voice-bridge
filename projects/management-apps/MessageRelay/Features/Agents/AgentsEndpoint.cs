using System.Text.Json;
using System.Text.Json.Serialization;
using MessageRelay.Wire;

namespace MessageRelay.Features.Agents;

/// <summary>
/// GET /agents — list of registered agents with derived state.
/// GET /agents/hierarchy — hierarchy JSON from <c>agents-hierarchy.json</c>.
/// Mirrors <c>registerAgentsRoutes</c> in <c>routes/agents.ts</c>.
/// </summary>
internal static class AgentsEndpoint
{
    private static readonly string HierarchyFile = Path.Combine(
        Directory.GetCurrentDirectory(),
        "agents-hierarchy.json");

    public static IEndpointRouteBuilder MapAgentsFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/agents", HandleAgents);
        app.MapGet("/agents/hierarchy", HandleHierarchyAsync);
        return app;
    }

    private static IResult HandleAgents(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        string dir = DiscoveryDirectory.Resolve(configuration);
        IReadOnlyList<string> names = DiscoveryDirectory.ListAgentNames(dir);

        List<AgentInfo> agents = new(names.Count);
        foreach (string name in names)
        {
            // The .NET relay has no real-time JSONL watcher — state is always
            // 'stale'. The TS sibling derives 'working'/'idle' from live JSONL
            // activity; adding that watcher is a separate task. hasChannel=true
            // for all port-file agents (they registered their channel).
            agents.Add(new AgentInfo(name, "stale", true));
        }

        agents.Sort(static (a, b) => string.Compare(a.Name, b.Name, StringComparison.Ordinal));
        return Results.Json(new AgentsResponse(agents));
    }

    private static async Task<IResult> HandleHierarchyAsync(CancellationToken cancellationToken)
    {
        try
        {
            string json = await File.ReadAllTextAsync(HierarchyFile, cancellationToken).ConfigureAwait(false);
            JsonDocument doc = JsonDocument.Parse(json);
            return Results.Json(doc.RootElement);
        }
        catch (FileNotFoundException) { }
        catch (IOException) { }
        catch (JsonException) { }

        return Results.Json(new { });
    }

    private sealed record AgentInfo(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("state")] string State,
        [property: JsonPropertyName("hasChannel")] bool HasChannel);

    private sealed record AgentsResponse([property: JsonPropertyName("agents")] List<AgentInfo> Agents);
}
