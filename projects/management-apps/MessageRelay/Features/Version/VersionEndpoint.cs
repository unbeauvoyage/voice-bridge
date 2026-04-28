using System.Diagnostics;
using System.Globalization;
using System.Text.Json.Serialization;

namespace MessageRelay.Features.Version;

/// <summary>
/// GET /version — service identity and capability handshake.
/// Shape: <c>{ name, branch, sha, startedAt, capabilities }</c>.
/// Mirrors <c>registerVersionRoute</c> in <c>routes/version.ts</c>.
/// Per <c>~/environment/decisions/service-compatibility-handshake.md</c>.
/// </summary>
internal static class VersionEndpoint
{
    private static volatile VersionResponse? _cached;
    private static readonly SemaphoreSlim InitLock = new(1, 1);

    public static IEndpointRouteBuilder MapVersionFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/version", HandleAsync);
        return app;
    }

    private static async Task<IResult> HandleAsync()
    {
        VersionResponse? response = _cached;
        if (response is not null)
        {
            return Results.Json(response);
        }

        await InitLock.WaitAsync().ConfigureAwait(false);
        try
        {
            VersionResponse built = await BuildResponseAsync().ConfigureAwait(false);
            _cached = built;
            return Results.Json(built);
        }
        finally
        {
            InitLock.Release();
        }
    }

    private static async Task<VersionResponse> BuildResponseAsync()
    {
        string branch = await RunGitAsync("rev-parse --abbrev-ref HEAD").ConfigureAwait(false);
        string sha = await RunGitAsync("rev-parse --short HEAD").ConfigureAwait(false);
        string startedAt = DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture);

        return new VersionResponse(
            Name: "message-relay",
            Branch: branch,
            Sha: sha,
            StartedAt: startedAt,
            Capabilities:
            [
                "messages.send",
                "messages.history",
                "agents.list",
                "agents.hierarchy",
                "agents.status",
                "agents.channels",
            ]);
    }

    private static async Task<string> RunGitAsync(string args)
    {
        try
        {
            using Process p = new();
            p.StartInfo = new ProcessStartInfo("git", args)
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            p.Start();
            string output = await p.StandardOutput.ReadToEndAsync().ConfigureAwait(false);
            await p.WaitForExitAsync().ConfigureAwait(false);
            return string.IsNullOrWhiteSpace(output) ? "unknown" : output.Trim();
        }
        catch (Exception ex) when (ex is IOException or InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            return "unknown";
        }
    }

    private sealed record VersionResponse(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("branch")] string Branch,
        [property: JsonPropertyName("sha")] string Sha,
        [property: JsonPropertyName("startedAt")] string StartedAt,
        [property: JsonPropertyName("capabilities")] string[] Capabilities);
}
