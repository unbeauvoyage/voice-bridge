// User story: CEO requests agent list — "ceo" and "relay" port files are
// present in the discovery directory but must NOT appear in the response.
// "chief-of-staff" is a valid non-system agent and MUST appear.
//
// Tests the I1/I2 fix: DiscoveryDirectory.ListAgentNames exclusion set.
// Negative control: Assert.DoesNotContain("ceo", ...) proves the exclusion
// check distinguishes between excluded system names and valid agent names.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class AgentsExcludesSystemNames : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public AgentsExcludesSystemNames(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetAgentsOmitsCeoAndRelayFromList()
    {
        // Given: discovery dir has port files for chief-of-staff, ceo, relay.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /agents.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/agents", UriKind.Relative), cts.Token);

        // Then: 200 + agents array includes chief-of-staff.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        AgentsPayload? body = await resp.Content.ReadFromJsonAsync<AgentsPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.NotNull(body.Agents);
        string[] names = body.Agents.Select(static a => a.Name).ToArray();
        Assert.Contains("chief-of-staff", names, StringComparer.Ordinal);

        // Negative control: system names are excluded even though their .port files exist.
        Assert.DoesNotContain("ceo", names, StringComparer.Ordinal);
        Assert.DoesNotContain("relay", names, StringComparer.Ordinal);
    }

    private sealed record AgentInfo(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("state")] string State,
        [property: JsonPropertyName("hasChannel")] bool HasChannel);

    private sealed record AgentsPayload(
        [property: JsonPropertyName("agents")] AgentInfo[] Agents);
}
