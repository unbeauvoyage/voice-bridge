using System.Security.Cryptography;
using ContentService.Tests.Fixtures;
using Xunit;

namespace ContentService.Tests.Stories.GetFile;

/// <summary>
/// User story: an agent fetches a stored image from the .NET content-service
/// by its content-hash URL and gets back the original bytes.
/// <para/>
/// Given the content-service-dotnet binary is running with a clean CONTENT_DIR
/// And a known PNG byte sequence has been pre-placed at &lt;CONTENT_DIR&gt;/&lt;sha256&gt;.png
/// When the agent issues GET /files/&lt;sha256&gt;.png
/// Then the response is 200, body is byte-identical to the pre-placed bytes,
/// Content-Type is image/png, and Cache-Control is the immutable CDN policy.
/// </summary>
public sealed class FetchesStoredImage(ContentServiceFixture fixture) : IClassFixture<ContentServiceFixture>
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
    public async Task AgentFetchesStoredImageByContentHashUrlAndGetsTheOriginalBytes()
    {
        CancellationToken ct = TestContext.Current.CancellationToken;

        string sha256 = Convert.ToHexString(SHA256.HashData(PngBytes)).ToLowerInvariant();
        string filename = $"{sha256}.png";
        string filePath = Path.Combine(fixture.ContentDir, filename);

        await using (FileStream stream = new(
            filePath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 4096,
            useAsync: true))
        {
            await stream.WriteAsync(PngBytes, ct);
        }

        using HttpClient client = fixture.CreateDotnetClient();
        using HttpResponseMessage response = await client.GetAsync(
            new Uri($"/files/{filename}", UriKind.Relative),
            ct);

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);

        byte[] body = await response.Content.ReadAsByteArrayAsync(ct);
        Assert.Equal(PngBytes, body);

        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(
            "public, max-age=31536000, immutable",
            response.Headers.CacheControl?.ToString());
    }
}
