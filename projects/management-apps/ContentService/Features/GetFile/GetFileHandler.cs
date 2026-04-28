using System.Diagnostics;
using System.Text.RegularExpressions;

namespace ContentService.Features.GetFile;

/// <summary>
/// Handler for GET /files/{idWithExt}. Streams the bytes for a previously
/// stored file by its content-hash filename.
/// <para/>
/// Path-traversal safety is enforced by <see cref="IdWithExtRegex"/>: the
/// path parameter must match <c>^[0-9a-f]{64}\.(?:png|jpg|webp|gif)$</c>.
/// Anything else returns 404 without touching the disk — there is no way
/// for a slash, dot-segment, or path separator to reach
/// <see cref="Path.Combine(string, string)"/>.
/// <para/>
/// File existence is probed by attempting the open and catching
/// <see cref="FileNotFoundException"/> / <see cref="DirectoryNotFoundException"/>
/// rather than calling <c>File.Exists</c> first (TOCTOU — and
/// <c>File.Exists</c> is banned via <c>BannedSymbols.txt</c> for that reason).
/// <para/>
/// Each handler invocation opens an Activity on the
/// <see cref="ContentServiceTelemetry.Source"/> source tagged with id, mime
/// (on hit only), and outcome (hit | not_found). Tracing infrastructure
/// (OTLP exporter + sampling) is wired by AddBackendDefaults().
/// </summary>
internal static partial class GetFileHandler
{
    private const string CacheControlImmutable = "public, max-age=31536000, immutable";
    private const string JsonContentType = "application/json; charset=utf-8";
    private const string ErrorNotFoundJson = """{"error":"not_found"}""";
    private const string ActivityName = "content_service.get_file";

    private static readonly Dictionary<string, string> MimeByExtension =
        new(StringComparer.Ordinal)
        {
            [".png"] = "image/png",
            [".jpg"] = "image/jpeg",
            [".webp"] = "image/webp",
            [".gif"] = "image/gif",
        };

    // Anchored, bounded, no nested quantifiers. NonBacktracking + ExplicitCapture
    // satisfy MA0009 (no ReDoS) and MA0023 (no implicit capture groups). The
    // extension alternation is a discriminator, not a capture target.
    [GeneratedRegex(
        "^[0-9a-f]{64}\\.(?:png|jpg|webp|gif)$",
        RegexOptions.NonBacktracking | RegexOptions.ExplicitCapture)]
    private static partial Regex IdWithExtRegex();

    public static async Task HandleAsync(
        string idWithExt,
        HttpContext httpContext,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        using Activity? activity = ContentServiceTelemetry.Source.StartActivity(ActivityName);
        activity?.SetTag("id", idWithExt);

        if (!IdWithExtRegex().IsMatch(idWithExt))
        {
            activity?.SetTag("outcome", "not_found");
            await RespondNotFoundAsync(httpContext, cancellationToken);
            return;
        }

        string contentDir = ResolveContentDir(configuration);
        string filePath = Path.Combine(contentDir, idWithExt);
        string extension = Path.GetExtension(idWithExt);
        string mimeType = MimeByExtension[extension];

        try
        {
            await using FileStream stream = new(
                filePath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 4096,
                useAsync: true);

            activity?.SetTag("mime", mimeType);
            activity?.SetTag("bytes", stream.Length);
            activity?.SetTag("outcome", "hit");

            httpContext.Response.StatusCode = StatusCodes.Status200OK;
            httpContext.Response.ContentType = mimeType;
            httpContext.Response.ContentLength = stream.Length;
            httpContext.Response.Headers.CacheControl = CacheControlImmutable;
            await stream.CopyToAsync(httpContext.Response.Body, cancellationToken);
        }
        catch (FileNotFoundException)
        {
            activity?.SetTag("outcome", "not_found");
            await RespondNotFoundAsync(httpContext, cancellationToken);
        }
        catch (DirectoryNotFoundException)
        {
            activity?.SetTag("outcome", "not_found");
            await RespondNotFoundAsync(httpContext, cancellationToken);
        }
    }

    private static string ResolveContentDir(IConfiguration configuration) =>
        configuration["CONTENT_DIR"]
            ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".claude",
                "content");

    private static async Task RespondNotFoundAsync(HttpContext context, CancellationToken cancellationToken)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        context.Response.ContentType = JsonContentType;
        await context.Response.WriteAsync(ErrorNotFoundJson, cancellationToken);
    }
}
