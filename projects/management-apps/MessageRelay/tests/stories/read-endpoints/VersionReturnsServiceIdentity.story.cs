// User story: CEO performs a capability handshake with relay-dotnet by calling
// /version — the response must identify the service as "message-relay" and
// list the six expected capabilities so the CEO app knows what features are
// available without parsing version numbers.
//
// Negative control: service name must NOT be "voice-bridge" or any other
// service — proves identity binding is correct, not just non-null.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class VersionReturnsServiceIdentity : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public VersionReturnsServiceIdentity(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetVersionReturnsMessageRelayWithExpectedCapabilities()
    {
        // Given: relay-dotnet is running.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /version.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/version", UriKind.Relative), cts.Token);

        // Then: 200 with name "message-relay" and all six capabilities.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        VersionPayload? body = await resp.Content.ReadFromJsonAsync<VersionPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.Equal("message-relay", body.Name);

        Assert.NotNull(body.Capabilities);
        Assert.Contains("messages.send", body.Capabilities, StringComparer.Ordinal);
        Assert.Contains("messages.history", body.Capabilities, StringComparer.Ordinal);
        Assert.Contains("agents.list", body.Capabilities, StringComparer.Ordinal);
        Assert.Contains("agents.hierarchy", body.Capabilities, StringComparer.Ordinal);
        Assert.Contains("agents.status", body.Capabilities, StringComparer.Ordinal);
        Assert.Contains("agents.channels", body.Capabilities, StringComparer.Ordinal);

        // Negative control: wrong service name fails.
        Assert.NotEqual("voice-bridge", body.Name);
    }

    private sealed record VersionPayload(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("branch")] string Branch,
        [property: JsonPropertyName("sha")] string Sha,
        [property: JsonPropertyName("startedAt")] string StartedAt,
        [property: JsonPropertyName("capabilities")] string[] Capabilities);
}
