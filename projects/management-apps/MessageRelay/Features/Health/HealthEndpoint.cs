using System.Text.Json.Serialization;
using MessageRelay.Features.Dashboard;

namespace MessageRelay.Features.Health;

/// <summary>
/// GET /health — relay-specific liveness snapshot. Mirrors the TypeScript
/// <c>handleHealth</c> in <c>routes/health.ts</c>.
/// Shape: <c>{ ok, relay, port, host, clients, uptime }</c>.
/// </summary>
internal static class HealthEndpoint
{
    private static readonly DateTimeOffset StartedAt = DateTimeOffset.UtcNow;

    public static IEndpointRouteBuilder MapHealthFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/health", Handle);
        return app;
    }

    private static IResult Handle(IDashboardBroadcaster broadcaster, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(broadcaster);
        ArgumentNullException.ThrowIfNull(configuration);

        string url = configuration["ASPNETCORE_URLS"] ?? configuration["urls"] ?? string.Empty;
        string host = ExtractHost(url);
        int port = ExtractPort(url);
        double uptime = (DateTimeOffset.UtcNow - StartedAt).TotalSeconds;

        return Results.Json(new HealthResponse(
            Ok: true,
            Relay: "lean",
            Port: port,
            Host: host,
            Clients: broadcaster.ClientCount,
            Uptime: uptime));
    }

    private static string ExtractHost(string url)
    {
        if (Uri.TryCreate(url.Split(';')[0], UriKind.Absolute, out Uri? uri))
        {
            return uri.Host;
        }

        return "0.0.0.0";
    }

    private static int ExtractPort(string url)
    {
        if (Uri.TryCreate(url.Split(';')[0], UriKind.Absolute, out Uri? uri))
        {
            return uri.Port;
        }

        return 0;
    }

    private sealed record HealthResponse(
        [property: JsonPropertyName("ok")] bool Ok,
        [property: JsonPropertyName("relay")] string Relay,
        [property: JsonPropertyName("port")] int Port,
        [property: JsonPropertyName("host")] string Host,
        [property: JsonPropertyName("clients")] int Clients,
        [property: JsonPropertyName("uptime")] double Uptime);
}
