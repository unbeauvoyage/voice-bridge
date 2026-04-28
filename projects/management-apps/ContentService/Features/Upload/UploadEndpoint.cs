namespace ContentService.Features.Upload;

/// <summary>
/// Vertical-slice endpoint registration for POST /upload. Wired in
/// Program.cs via <c>app.MapUploadFeature();</c>.
/// <para/>
/// <c>DisableAntiforgery()</c> is required because antiforgery is enabled
/// by default in ASP.NET Core for form posts; the content service is a
/// non-browser API (HTTP clients post images directly), and forcing an
/// antiforgery token would break ceo-app + voice-bridge integrations.
/// </summary>
internal static class UploadEndpoint
{
    public static IEndpointRouteBuilder MapUploadFeature(this IEndpointRouteBuilder app)
    {
        app.MapPost("/upload", UploadHandler.HandleAsync).DisableAntiforgery();
        return app;
    }
}
