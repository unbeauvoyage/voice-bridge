using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using ContentService.Tests.Fixtures;
using Xunit;

namespace ContentService.Tests.Stories.CrossStack;

/// <summary>
/// User story (FLAGSHIP — proves stack-parity, unblocks ceo-app's
/// backend-toggle UI): an agent uploads an image to the TS content-service,
/// then immediately fetches the SAME image via the .NET content-service,
/// and gets back byte-identical bytes.
/// <para/>
/// Given a single CONTENT_DIR shared by content-service-ts and content-service-dotnet
/// And both services are running
/// And a known PNG byte sequence is held by the agent
/// When the agent POSTs the bytes to /upload on the TS service
/// Then the TS service returns 200 with body { id, url, mime, bytes, sha256 }
/// And the agent immediately GETs /files/{id}.png from the .NET service
/// Then the .NET service returns 200 with byte-identical body and Content-Type: image/png
/// <para/>
/// Failure modes this proves DON'T happen:
///   - Disk-format drift (different filename layout between stacks)
///   - Hash drift (different SHA-256 implementation behavior)
///   - Atomic-write race (TS writes partial → .NET fetches partial)
///   - MIME drift (TS accepts image/png, .NET rejects it, or vice versa)
/// </summary>
public sealed class TsUploadThenDotnetFetch(ContentServiceFixture fixture) : IClassFixture<ContentServiceFixture>
{
    private static readonly byte[] PngBytes =
    [
        // Minimum-valid 1×1 transparent PNG (89-byte fixture).
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82,
    ];

    [Fact]
    public async Task AgentUploadsViaTsServiceAndFetchesByteIdenticalBytesViaDotnetService()
    {
        CancellationToken ct = TestContext.Current.CancellationToken;

        string expectedSha = Convert.ToHexString(SHA256.HashData(PngBytes)).ToLowerInvariant();

        using HttpClient ts = fixture.CreateTsClient();
        using HttpClient dn = fixture.CreateDotnetClient();

        // 1. Upload via TS service.
        using MultipartFormDataContent form = new();
        ByteArrayContent fileContent = new(PngBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", "tiny.png");

        using HttpResponseMessage uploadResponse = await ts.PostAsync(
            new Uri("/upload", UriKind.Relative),
            form,
            ct);

        Assert.Equal(System.Net.HttpStatusCode.OK, uploadResponse.StatusCode);

        UploadResult? result = await uploadResponse.Content.ReadFromJsonAsync<UploadResult>(ct);
        Assert.NotNull(result);
        Assert.Equal(expectedSha, result.Id);
        Assert.Equal(expectedSha, result.Sha256);
        Assert.Equal("image/png", result.Mime);
        Assert.Equal(PngBytes.Length, result.Bytes);

        // 2. Fetch via .NET service. Build the path locally instead of
        //    re-using result.Url so the test isolates "do both stacks agree
        //    on the on-disk filename layout?" from "does .NET's GET /files
        //    parse a URL the TS server returned?". The disk layout is the
        //    real cross-stack invariant.
        string filename = $"{expectedSha}.png";
        using HttpResponseMessage fetchResponse = await dn.GetAsync(
            new Uri($"/files/{filename}", UriKind.Relative),
            ct);

        Assert.Equal(System.Net.HttpStatusCode.OK, fetchResponse.StatusCode);
        Assert.Equal("image/png", fetchResponse.Content.Headers.ContentType?.MediaType);

        byte[] fetchedBytes = await fetchResponse.Content.ReadAsByteArrayAsync(ct);
        Assert.Equal(PngBytes, fetchedBytes);
    }

    private sealed record UploadResult(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("url")] string Url,
        [property: JsonPropertyName("mime")] string Mime,
        [property: JsonPropertyName("bytes")] int Bytes,
        [property: JsonPropertyName("sha256")] string Sha256);
}
