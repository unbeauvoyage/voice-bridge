// User story: CEO views raw JSONL diagnostic data for an agent with no
// sessions — relay-dotnet must return { sessionId: null, path: null,
// records: [] } and NOT crash or return a 404.
//
// Negative control: records array must be empty (not null), proving the
// endpoint distinguishes "no sessions" from "error".

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class RawReturnsEmptyForUnknownAgent : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public RawReturnsEmptyForUnknownAgent(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetRawReturnsNullSessionAndEmptyRecordsWhenNoSessions()
    {
        // Given: "story-test-only" has no JSONL session files.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /raw/story-test-only.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/raw/story-test-only", UriKind.Relative), cts.Token);

        // Then: 200 with null sessionId and empty records array.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        RawPayload? body = await resp.Content.ReadFromJsonAsync<RawPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.Null(body.SessionId);
        Assert.Null(body.Path);

        // Negative control: records is a non-null empty array, not null.
        Assert.NotNull(body.Records);
        Assert.Empty(body.Records);
    }

    private sealed record RawPayload(
        [property: JsonPropertyName("sessionId")] string? SessionId,
        [property: JsonPropertyName("path")] string? Path,
        [property: JsonPropertyName("records")] JsonElement[] Records);
}
