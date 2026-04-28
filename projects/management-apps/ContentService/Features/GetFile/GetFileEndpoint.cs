namespace ContentService.Features.GetFile;

/// <summary>
/// Vertical-slice endpoint registration for GET /files/{idWithExt}. Wired in
/// Program.cs via a single call: <c>app.MapGetFileFeature();</c>
/// </summary>
internal static class GetFileEndpoint
{
    public static IEndpointRouteBuilder MapGetFileFeature(this IEndpointRouteBuilder app)
    {
        app.MapGet("/files/{idWithExt}", GetFileHandler.HandleAsync);
        return app;
    }
}
