namespace ContentService.Features.Health;

/// <summary>
/// GET /health — content-service-specific shape: <c>{status:"ok", service:"content-service"}</c>.
/// The default Aspire <c>MapDefaultEndpoints()</c> body shape does NOT
/// match this contract; ceo-app's backend toggle reads <c>service</c> to
/// confirm it's talking to the expected backend, so the toggle stays
/// invisible only if both stacks return identical bodies here.
/// </summary>
internal static class HealthEndpoint
{
    private static readonly HealthResponse Body = new("ok", "content-service");

    public static IEndpointRouteBuilder MapHealthFeature(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () => Results.Json(Body));
        return app;
    }

    private sealed record HealthResponse(string Status, string Service);
}
