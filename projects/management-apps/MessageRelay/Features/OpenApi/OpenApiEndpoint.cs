namespace MessageRelay.Features.OpenApi;

/// <summary>
/// GET /openapi.yaml — serves the byte-identical TS OpenAPI document
/// that ships with message-relay/docs/. The file is brought into the
/// build output via a Linked &lt;Content&gt; item in MessageRelay.csproj
/// (CopyToOutputDirectory="PreserveNewest"), which deposits it at
/// <c>$(OutDir)/docs/openapi.yaml</c>. We resolve that path via
/// <see cref="AppContext.BaseDirectory"/> rather than
/// <c>IWebHostEnvironment.ContentRootPath</c> because the latter points at
/// the project source root under <c>dotnet run</c>, not the bin output dir.
/// </summary>
internal static class OpenApiEndpoint
{
    private const string YamlContentType = "application/yaml; charset=utf-8";

    private static readonly string YamlPath =
        Path.Combine(AppContext.BaseDirectory, "docs", "openapi.yaml");

    public static IEndpointRouteBuilder MapOpenApiFeature(this IEndpointRouteBuilder app)
    {
        app.MapGet("/openapi.yaml", HandleAsync);
        return app;
    }

    private static async Task HandleAsync(HttpContext httpContext, CancellationToken cancellationToken)
    {
        try
        {
            await using FileStream stream = new(
                YamlPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 4096,
                useAsync: true);

            httpContext.Response.StatusCode = StatusCodes.Status200OK;
            httpContext.Response.ContentType = YamlContentType;
            httpContext.Response.ContentLength = stream.Length;
            await stream.CopyToAsync(httpContext.Response.Body, cancellationToken).ConfigureAwait(false);
        }
        catch (FileNotFoundException)
        {
            await RespondMissingAsync(httpContext, cancellationToken).ConfigureAwait(false);
        }
        catch (DirectoryNotFoundException)
        {
            await RespondMissingAsync(httpContext, cancellationToken).ConfigureAwait(false);
        }
    }

    private static async Task RespondMissingAsync(HttpContext httpContext, CancellationToken cancellationToken)
    {
        // The Linked Content item should have produced the file at
        // <bin>/docs/openapi.yaml. If not, the build is broken — surface 500
        // so the failure is visible rather than papering over it.
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        httpContext.Response.ContentType = "text/plain; charset=utf-8";
        await httpContext.Response.WriteAsync(
            "openapi.yaml is missing from the build output. Expected the Linked <Content> item to copy ../message-relay/docs/openapi.yaml.",
            cancellationToken).ConfigureAwait(false);
    }
}
