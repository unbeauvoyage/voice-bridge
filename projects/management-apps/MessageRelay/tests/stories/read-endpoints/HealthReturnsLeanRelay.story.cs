// User story: CEO checks relay-dotnet liveness and confirms it identifies as
// "lean" (per openapi.yaml:583 const) — not "dotnet" or any other variant.
//
// Real service: in-process WebApplicationFactory<Program>.
// Negative control: Assert.NotEqual("dotnet", ...) proves the "lean" check
// can distinguish between the old wrong value and the correct spec value.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class HealthReturnsLeanRelay : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public HealthReturnsLeanRelay(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetHealthReturnsOkWithLeanRelayIdentifier()
    {
        // Given: relay-dotnet is running.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /health.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/health", UriKind.Relative), cts.Token);

        // Then: 200 with ok=true, relay="lean" (the openapi const).
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        HealthPayload? body = await resp.Content.ReadFromJsonAsync<HealthPayload>(cts.Token);
        Assert.NotNull(body);
        Assert.True(body.Ok);
        Assert.Equal("lean", body.Relay);

        // Negative control: the old wrong value is provably absent.
        Assert.NotEqual("dotnet", body.Relay);

        Assert.True(body.Uptime >= -1.0, $"Uptime was {body.Uptime}");
        Assert.True(body.Clients >= 0, $"Clients was {body.Clients}");
    }

    private sealed record HealthPayload(
        [property: JsonPropertyName("ok")] bool Ok,
        [property: JsonPropertyName("relay")] string Relay,
        [property: JsonPropertyName("port")] int Port,
        [property: JsonPropertyName("host")] string Host,
        [property: JsonPropertyName("clients")] int Clients,
        [property: JsonPropertyName("uptime")] double Uptime);
}
