using System.Buffers;
using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Primitives;

namespace ContentService.Features.Upload;

/// <summary>
/// Handler for POST /upload. Reads a single multipart <c>file</c> field,
/// streams it to a temp file while computing SHA-256 incrementally, then
/// renames the temp into the final content-addressed path
/// <c>&lt;CONTENT_DIR&gt;/&lt;sha256&gt;.&lt;ext&gt;</c>.
/// <para/>
/// The temp+rename pattern guarantees that GET /files never observes a
/// partial file: the final path appears atomically once the bytes are
/// fully written and verified. POSIX <c>File.Move(..., overwrite:false)</c>
/// is atomic on the same volume.
/// <para/>
/// Hash collision policy: SHA-256 collisions are infeasible. If the final
/// path already exists, we treat the upload as a dedup hit, discard the
/// temp file, and return the same shape as a normal success — the existing
/// bytes on disk are byte-identical to what the client just uploaded.
/// </summary>
internal static partial class UploadHandler
{
    private const long MaxBytes = 25L * 1024L * 1024L;
    private const int CopyBufferSize = 81920;
    private const string ActivityName = "content_service.upload";

    private static readonly Dictionary<string, string> ExtensionByMime =
        new(StringComparer.Ordinal)
        {
            ["image/png"] = "png",
            ["image/jpeg"] = "jpg",
            ["image/webp"] = "webp",
            ["image/gif"] = "gif",
        };

    private static readonly string[] AllowedMimes = [.. ExtensionByMime.Keys];

    // Validated before Path.Combine so taint analyzers (CA3003, SCS0018)
    // recognise both path segments as sanitized inputs.
    [GeneratedRegex("^[0-9a-f]{64}$", RegexOptions.NonBacktracking | RegexOptions.ExplicitCapture)]
    private static partial Regex Sha256HexRegex();

    [GeneratedRegex("^(?:png|jpg|webp|gif)$", RegexOptions.NonBacktracking | RegexOptions.ExplicitCapture)]
    private static partial Regex FileExtensionRegex();

    public static async Task HandleAsync(
        HttpContext httpContext,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        using Activity? activity = ContentServiceTelemetry.Source.StartActivity(ActivityName);

        ValidationOutcome validation = await ValidateRequestAsync(httpContext, cancellationToken);
        if (validation.ErrorResponse is not null)
        {
            activity?.SetTag("outcome", validation.ErrorResponse.Outcome);
            await WriteErrorAsync(httpContext, validation.ErrorResponse, cancellationToken);
            return;
        }

        IFormFile file = validation.File!;
        string contentType = validation.ContentType!;
        string extension = validation.Extension!;

        string contentDir = ResolveContentDir(configuration);
        Directory.CreateDirectory(contentDir);

        StoredFile stored = await PersistAsync(file, contentDir, extension, cancellationToken);

        RecordSuccessTelemetry(activity, contentType, stored);

        string filename = $"{stored.Sha256}.{extension}";
        string url = BuildAbsoluteUrl(httpContext.Request, filename);
        UploadResult result = new(stored.Sha256, url, contentType, stored.Bytes, stored.Sha256);
        await httpContext.Response.WriteAsJsonAsync(result, cancellationToken);
    }

    private static async Task<ValidationOutcome> ValidateRequestAsync(
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (!httpContext.Request.HasFormContentType)
        {
            return ValidationOutcome.Reject(ErrorResponse.NoFile());
        }

        IFormCollection form;
        try
        {
            form = await httpContext.Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return ValidationOutcome.Reject(ErrorResponse.TooLarge());
        }

        IFormFile? file = form.Files.GetFile("file");
        if (file is null)
        {
            return ValidationOutcome.Reject(ErrorResponse.NoFile());
        }

        // Mirror TS validation order: mime → too_large → empty.
        // A 0-byte upload with an invalid MIME gets 415, not 400.
        string contentType = file.ContentType ?? string.Empty;
        if (!ExtensionByMime.TryGetValue(contentType, out string? extension))
        {
            return ValidationOutcome.Reject(ErrorResponse.UnsupportedMime(contentType));
        }

        if (file.Length > MaxBytes)
        {
            return ValidationOutcome.Reject(ErrorResponse.TooLarge());
        }

        if (file.Length == 0)
        {
            return ValidationOutcome.Reject(ErrorResponse.EmptyFile());
        }

        return ValidationOutcome.Accept(file, contentType, extension);
    }

    private static async Task<StoredFile> PersistAsync(
        IFormFile file,
        string contentDir,
        string extension,
        CancellationToken cancellationToken)
    {
        string tempPath = Path.Combine(contentDir, $".upload-{Guid.NewGuid():N}.tmp");

        StreamingResult streamed;
        try
        {
            streamed = await StreamHashAndWriteAsync(file, tempPath, cancellationToken);
        }
        catch
        {
            TryDeleteTemp(tempPath);
            throw;
        }

        bool dedupHit = MoveOrDedup(tempPath, contentDir, streamed.Sha256, extension);
        return new StoredFile(streamed.Sha256, streamed.TotalBytes, dedupHit);
    }

    private static async Task<StreamingResult> StreamHashAndWriteAsync(
        IFormFile file,
        string tempPath,
        CancellationToken cancellationToken)
    {
        byte[] buffer = ArrayPool<byte>.Shared.Rent(CopyBufferSize);
        try
        {
            using IncrementalHash hasher = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using Stream source = file.OpenReadStream();

            long totalBytes;
            await using (FileStream tempFile = new(
                tempPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                CopyBufferSize,
                useAsync: true))
            {
                totalBytes = 0;
                int read;
                while ((read = await source.ReadAsync(buffer.AsMemory(0, CopyBufferSize), cancellationToken)) > 0)
                {
                    totalBytes += read;
                    if (totalBytes > MaxBytes)
                    {
                        throw new InvalidOperationException(
                            $"Upload exceeded {MaxBytes.ToString(CultureInfo.InvariantCulture)} bytes during streaming.");
                    }
                    hasher.AppendData(buffer.AsSpan(0, read));
                    await tempFile.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                }
                await tempFile.FlushAsync(cancellationToken);
            }

            string sha = Convert.ToHexString(hasher.GetHashAndReset()).ToLowerInvariant();
            return new StreamingResult(sha, totalBytes);
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private static bool MoveOrDedup(string tempPath, string contentDir, string sha, string extension)
    {
        // Regex guards satisfy CA3003 + SCS0018 taint tracking. Both values
        // are provably safe at this point (sha = hash output, extension =
        // closed-set dictionary value), but the analyzer cannot follow those
        // flows. Explicit validation gives the analyzer an unambiguous signal.
        if (!Sha256HexRegex().IsMatch(sha) || !FileExtensionRegex().IsMatch(extension))
        {
            throw new InvalidOperationException(
                $"Rejected unsafe path segment: sha={sha.Length}chars, ext={extension}");
        }

        string finalPath = Path.Combine(contentDir, $"{sha}.{extension}");
        try
        {
            File.Move(tempPath, finalPath, overwrite: false);
            return false;
        }
        catch (IOException)
        {
            // POSIX File.Move(overwrite:false) refuses if dest exists. SHA-256
            // collisions are infeasible, so a pre-existing destination is the
            // same content the client just uploaded. Treat as dedup hit.
            // (File.Exists is banned via BannedSymbols.txt — never probe ahead.)
            TryDeleteTemp(tempPath);
            return true;
        }
    }

    private static void RecordSuccessTelemetry(Activity? activity, string contentType, StoredFile stored)
    {
        activity?.SetTag("mime", contentType);
        activity?.SetTag("bytes", stored.Bytes);
        activity?.SetTag("outcome", stored.WasDedupHit ? "dedup_hit" : "stored");

        KeyValuePair<string, object?> mimeTag = new("mime", contentType);
        if (stored.WasDedupHit)
        {
            ContentServiceTelemetry.DedupHits.Add(1, mimeTag);
        }
        else
        {
            ContentServiceTelemetry.UploadsTotal.Add(1, mimeTag);
            ContentServiceTelemetry.BytesStored.Add(stored.Bytes, mimeTag);
        }
    }

    private static void TryDeleteTemp(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (FileNotFoundException) { }
        catch (DirectoryNotFoundException) { }
        catch (IOException) { }
    }

    private static string ResolveContentDir(IConfiguration configuration) =>
        configuration["CONTENT_DIR"]
            ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".claude",
                "content");

    private static string BuildAbsoluteUrl(HttpRequest request, string filename)
    {
        string scheme = ResolveForwardedHeader(request, "x-forwarded-proto") ?? request.Scheme;
        string host = ResolveForwardedHeader(request, "x-forwarded-host") ?? request.Host.ToString();
        return $"{scheme}://{host}/files/{filename}";
    }

    private static string? ResolveForwardedHeader(HttpRequest request, string name)
    {
        if (!request.Headers.TryGetValue(name, out StringValues values) || values.Count == 0)
        {
            return null;
        }
        string? first = values[0];
        return string.IsNullOrEmpty(first) ? null : first;
    }

    private static async Task WriteErrorAsync(
        HttpContext httpContext,
        ErrorResponse error,
        CancellationToken cancellationToken)
    {
        httpContext.Response.StatusCode = error.StatusCode;
        await httpContext.Response.WriteAsJsonAsync(error.Body, cancellationToken);
    }

    private readonly record struct StreamingResult(string Sha256, long TotalBytes);

    private readonly record struct StoredFile(string Sha256, long Bytes, bool WasDedupHit);

    private readonly record struct ValidationOutcome(
        IFormFile? File,
        string? ContentType,
        string? Extension,
        ErrorResponse? ErrorResponse)
    {
        public static ValidationOutcome Accept(IFormFile file, string contentType, string extension) =>
            new(file, contentType, extension, null);

        public static ValidationOutcome Reject(ErrorResponse error) =>
            new(null, null, null, error);
    }

    private sealed record ErrorResponse(int StatusCode, string Outcome, object Body)
    {
        public static ErrorResponse NoFile() => new(
            StatusCodes.Status400BadRequest,
            "no_file",
            new { error = "no_file" });

        public static ErrorResponse EmptyFile() => new(
            StatusCodes.Status400BadRequest,
            "empty_file",
            new { error = "empty_file" });

        public static ErrorResponse TooLarge() => new(
            StatusCodes.Status413PayloadTooLarge,
            "too_large",
            new { error = "too_large", maxBytes = MaxBytes });

        public static ErrorResponse UnsupportedMime(string contentType) => new(
            StatusCodes.Status415UnsupportedMediaType,
            "unsupported_media_type",
            new
            {
                error = "unsupported_media_type",
                message = $"Content type '{contentType}' is not supported. Allowed: {string.Join(", ", AllowedMimes)}.",
                allowed = AllowedMimes,
            });
    }
}
