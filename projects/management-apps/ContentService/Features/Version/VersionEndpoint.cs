namespace ContentService.Features.Version;

/// <summary>
/// GET /version — content-service-specific shape:
/// <c>{name:"content-service", version:"0.1.0"}</c>. The OpenAPI spec
/// declares <c>name</c> and <c>version</c> as content-service-specific
/// constants — NOT the .NET assembly version.
/// </summary>
internal static class VersionEndpoint
{
    private static readonly VersionResponse Body = new("content-service", "0.1.0");

    public static IEndpointRouteBuilder MapVersionFeature(this IEndpointRouteBuilder app)
    {
        app.MapGet("/version", () => Results.Json(Body));
        return app;
    }

    private sealed record VersionResponse(string Name, string Version);
}
