namespace VoiceBridge.Features.Health;

/// <summary>
/// GET /health — voice-bridge-specific shape: <c>{status:"ok", ts:&lt;unix-ms&gt;}</c>.
/// The default Aspire <c>MapDefaultEndpoints()</c> body is plain-text
/// "Healthy", which does NOT match the TS sibling at
/// <c>voice-bridge2/server/index.ts</c>. ceo-app's backend toggle relies on
/// both stacks returning byte-identical bodies on this path so the flip is
/// invisible to the client; we override here.
/// </summary>
internal static class HealthEndpoint
{
    public static IEndpointRouteBuilder MapHealthFeature(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", (TimeProvider time) =>
            Results.Json(new HealthResponse("ok", time.GetUtcNow().ToUnixTimeMilliseconds())));
        return app;
    }

    private sealed record HealthResponse(string Status, long Ts);
}
