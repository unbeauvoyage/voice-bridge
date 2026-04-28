// User story: CEO requests channel list — returns channel entries for agents
// with valid port files. "ceo" and "relay" must be excluded despite having
// .port files; "chief-of-staff" must appear with the port value from its file.
//
// Negative control: channels array must NOT contain "ceo" or "relay" agent
// names — proves the exclusion list is applied to ListPortEntriesAsync too.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class ChannelsListsConnectedAgents : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public ChannelsListsConnectedAgents(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetChannelsReturnsChiefOfStaffExcludesSystemNames()
    {
        // Given: discovery dir has three .port files; only chief-of-staff is valid.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /channels.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/channels", UriKind.Relative), cts.Token);

        // Then: 200 + channels array includes chief-of-staff with port 9000.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        ChannelsPayload? body = await resp.Content.ReadFromJsonAsync<ChannelsPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.NotNull(body.Channels);
        string[] agents = body.Channels.Select(static c => c.Agent).ToArray();
        Assert.Contains("chief-of-staff", agents, StringComparer.Ordinal);

        ChannelInfo? cos = body.Channels.FirstOrDefault(static c =>
            string.Equals(c.Agent, "chief-of-staff", StringComparison.Ordinal));
        Assert.NotNull(cos);
        Assert.Equal(9000, cos.Port);

        // Negative control: system names are excluded from channels.
        Assert.DoesNotContain("ceo", agents, StringComparer.Ordinal);
        Assert.DoesNotContain("relay", agents, StringComparer.Ordinal);
    }

    private sealed record ChannelInfo(
        [property: JsonPropertyName("agent")] string Agent,
        [property: JsonPropertyName("port")] int Port);

    private sealed record ChannelsPayload(
        [property: JsonPropertyName("channels")] ChannelInfo[] Channels);
}
