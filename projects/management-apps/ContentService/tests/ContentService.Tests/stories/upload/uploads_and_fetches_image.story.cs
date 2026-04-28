using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using ContentService.Tests.Fixtures;
using Xunit;

namespace ContentService.Tests.Stories.Upload;

/// <summary>
/// User story: an agent uploads an image to /upload and immediately fetches
/// it back via the returned URL.
/// <para/>
/// Given the content-service-dotnet binary is running with a clean CONTENT_DIR
/// And a known PNG byte sequence is held by the agent
/// When the agent POSTs the bytes to /upload as multipart/form-data field "file"
/// Then the response is 200 with body { id, url, mime, bytes, sha256 } where
///   - id == sha256 == the agent's expected SHA-256 hex digest
///   - mime == "image/png"
///   - bytes == byte count
///   - url ends with /files/{sha256}.png
/// And the file exists on disk at {CONTENT_DIR}/{sha256}.png with the
///   byte-identical contents
/// And GET'ing the returned URL replies 200 with byte-identical body and
///   Content-Type: image/png
/// <para/>
/// Atomicity: a successful POST guarantees the final file is the byte-identical
/// payload — no partial files visible to GET in any interleaving (the
/// implementation uses a temp+rename pattern enforced by File.Move(overwrite:false)).
/// </summary>
public sealed class UploadsAndFetchesImage(ContentServiceFixture fixture) : IClassFixture<ContentServiceFixture>
{
    private static readonly byte[] PngBytes =
    [
        // Minimum-valid 1×1 transparent PNG (89-byte fixture). Distinct from
        // the GetFile story's fixture so a mistakenly-shared static cache
        // would not silently make this test pass.
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
    public async Task AgentUploadsImageAndImmediatelyFetchesItByTheReturnedUrl()
    {
        CancellationToken ct = TestContext.Current.CancellationToken;

        string expectedSha = Convert.ToHexString(SHA256.HashData(PngBytes)).ToLowerInvariant();
        string expectedFilename = $"{expectedSha}.png";
        string expectedDiskPath = Path.Combine(fixture.ContentDir, expectedFilename);

        using HttpClient client = fixture.CreateDotnetClient();

        using MultipartFormDataContent form = new();
        ByteArrayContent fileContent = new(PngBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", "tiny.png");

        using HttpResponseMessage uploadResponse = await client.PostAsync(
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
        Assert.EndsWith($"/files/{expectedFilename}", result.Url, StringComparison.Ordinal);

        byte[] onDiskBytes = await File.ReadAllBytesAsync(expectedDiskPath, ct);
        Assert.Equal(PngBytes, onDiskBytes);

        using HttpResponseMessage fetchResponse = await client.GetAsync(
            new Uri($"/files/{expectedFilename}", UriKind.Relative),
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
