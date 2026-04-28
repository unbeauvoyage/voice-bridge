using System.Text.Json.Serialization;
using MessageRelay.Wire;

namespace MessageRelay.Features.Status;

/// <summary>
/// GET /status — online agents map derived from port files.
/// Shape: <c>{ agents: { "&lt;name&gt;": { workspace: "&lt;name&gt;" } } }</c>.
/// Mirrors <c>handleStatus</c> in <c>routes/status.ts</c>.
/// Used by mobile VoicePage / fetchWorkspaces.
/// </summary>
internal static class StatusEndpoint
{
    public static IEndpointRouteBuilder MapStatusFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/status", Handle);
        return app;
    }

    private static IResult Handle(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        string dir = DiscoveryDirectory.Resolve(configuration);
        IReadOnlyList<string> names = DiscoveryDirectory.ListAgentNames(dir);

        Dictionary<string, AgentWorkspace> agents = new(StringComparer.Ordinal);
        foreach (string name in names)
        {
            agents[name] = new AgentWorkspace(name);
        }

        return Results.Json(new StatusResponse(agents));
    }

    private sealed record AgentWorkspace([property: JsonPropertyName("workspace")] string Workspace);

    private sealed record StatusResponse([property: JsonPropertyName("agents")] Dictionary<string, AgentWorkspace> Agents);
}
