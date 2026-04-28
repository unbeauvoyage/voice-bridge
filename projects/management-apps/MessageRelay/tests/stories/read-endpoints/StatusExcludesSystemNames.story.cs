// User story: CEO requests agent status overview — "ceo" and "relay" port files
// exist but must be absent from the status map. "chief-of-staff" must appear.
//
// Tests the I1/I2 exclusion fix via the /status endpoint (same ListAgentNames path).
// Negative control: presence of "ceo" key in the agents map would mean exclusion
// failed — Assert.False proves exclusion is active.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class StatusExcludesSystemNames : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public StatusExcludesSystemNames(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetStatusOmitsCeoAndRelayFromAgentsMap()
    {
        // Given: discovery dir has port files for chief-of-staff, ceo, relay.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /status.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/status", UriKind.Relative), cts.Token);

        // Then: 200 + agents map contains chief-of-staff.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        StatusPayload? body = await resp.Content.ReadFromJsonAsync<StatusPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.NotNull(body.Agents);
        Assert.True(body.Agents.ContainsKey("chief-of-staff"), "chief-of-staff must appear in status map");

        // Negative control: system names are excluded even though their .port files exist.
        Assert.False(body.Agents.ContainsKey("ceo"), "ceo must be excluded from status map");
        Assert.False(body.Agents.ContainsKey("relay"), "relay must be excluded from status map");
    }

    private sealed record AgentWorkspace([property: JsonPropertyName("workspace")] string Workspace);

    private sealed record StatusPayload(
        [property: JsonPropertyName("agents")] Dictionary<string, AgentWorkspace> Agents);
}
