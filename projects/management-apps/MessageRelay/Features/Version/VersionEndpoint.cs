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
    private static readonly VersionResponse Response = BuildResponse();

    public static IEndpointRouteBuilder MapVersionFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/version", static () => Results.Json(Response));
        return app;
    }

    private static VersionResponse BuildResponse()
    {
        string branch = RunGitSync("rev-parse --abbrev-ref HEAD");
        string sha = RunGitSync("rev-parse --short HEAD");
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

    private static string RunGitSync(string args)
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
            // Version is computed once at startup — blocking wait is acceptable
            // (startup path, not request path). MA0045 applies to hot paths;
            // ProcessStartInfo.RedirectStandardOutput requires sync read here
            // because p.StandardOutput.ReadToEndAsync + WaitForExitAsync would
            // need an async context that the static field initializer cannot provide.
#pragma warning disable MA0045
            string output = p.StandardOutput.ReadToEnd().Trim();
            p.WaitForExit();
#pragma warning restore MA0045
            return string.IsNullOrEmpty(output) ? "unknown" : output;
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
