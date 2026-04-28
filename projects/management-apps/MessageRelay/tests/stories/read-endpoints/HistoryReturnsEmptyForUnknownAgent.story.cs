// User story: CEO browses message history for an agent whose JSONL sessions do
// not exist on this machine — relay-dotnet must return an empty messages array,
// not a 404, 500, or error JSON.
//
// Also tests the invalid-name guard: a name that fails AgentName.IsValid must
// return 400 Bad Request (negative control for the happy path).

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class HistoryReturnsEmptyForUnknownAgent : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public HistoryReturnsEmptyForUnknownAgent(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetHistoryReturnsEmptyMessagesWhenNoSessionsExist()
    {
        // Given: "story-test-only" is a valid name with no JSONL sessions.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests history for that agent.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/history/story-test-only", UriKind.Relative), cts.Token);

        // Then: 200 with an empty messages array.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        HistoryPayload? body = await resp.Content.ReadFromJsonAsync<HistoryPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.NotNull(body.Messages);
        Assert.Empty(body.Messages);
    }

    [Fact]
    public async Task GetHistoryRejectsBadAgentName()
    {
        // Negative control: a name with a space is invalid — proves the guard fires.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        HttpResponseMessage resp = await http.GetAsync(new Uri("/history/bad%20name", UriKind.Relative), cts.Token);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    private sealed record HistoryPayload(
        [property: JsonPropertyName("messages")] object[] Messages);
}
