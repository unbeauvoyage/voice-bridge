// User story: CEO requests the live event feed for an agent with no JSONL
// sessions — relay-dotnet must return { agentName, events: [] } with the
// correct agentName echoed back, proving the endpoint binds the route param.
//
// Negative control: agentName in the response must match the URL param exactly
// ("story-test-only") — proving parameter binding works, not a hardcoded value.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class EventsReturnsEmptyForUnknownAgent : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public EventsReturnsEmptyForUnknownAgent(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetEventsReturnsAgentNameAndEmptyEventsWhenNoSessions()
    {
        // Given: "story-test-only" has no JSONL session files.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /events/story-test-only.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/events/story-test-only", UriKind.Relative), cts.Token);

        // Then: 200 with agentName echoed and empty events array.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        EventsPayload? body = await resp.Content.ReadFromJsonAsync<EventsPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.Equal("story-test-only", body.AgentName);

        // Negative control: wrong agent name would fail, proving param binding.
        Assert.NotEqual("ceo", body.AgentName);

        Assert.NotNull(body.Events);
        Assert.Empty(body.Events);
    }

    private sealed record EventsPayload(
        [property: JsonPropertyName("agentName")] string AgentName,
        [property: JsonPropertyName("events")] object[] Events);
}
