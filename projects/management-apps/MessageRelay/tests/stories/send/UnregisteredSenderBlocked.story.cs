// User story: POST /send with a sender that has no registered port file is
// rejected with 403 Forbidden and a machine-readable error body.
//
// The "always-allowed" set is currently just {"ceo"}. Any other sender must
// have a port file in the relay discovery dir or the request is blocked before
// routing — callers cannot inject messages as an arbitrary fake identity.
//
// Two assertions:
//   1. POST with unregistered sender → 403 + SendError body.
//   2. Negative control: create the port file → POST → NOT 403 (200 delivered).
//      This proves the 403 is gated on the file's existence, not always-on.
//
// Real services: in-process WebApplicationFactory<Program> (real pipeline,
// real SenderRegistry filesystem check). The factory overrides
// RELAY_DISCOVERY_DIR to a temp dir so tests are hermetic.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.Send;

public sealed class UnregisteredSenderBlocked : IClassFixture<SenderBlockingRelayWebAppFactory>
{
    private readonly SenderBlockingRelayWebAppFactory factory;

    public UnregisteredSenderBlocked(SenderBlockingRelayWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task UnregisteredSenderIsRejectedWith403()
    {
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        SendRequestPayload request = new(
            From: "unregistered-agent",
            To: "ceo",
            Body: "should-be-blocked",
            Type: "message");

        // ── Assertion 1 — unregistered sender → 403 ──────────────────────────
        HttpResponseMessage response = await http.PostAsJsonAsync("/send", request, JsonOpts, cts.Token);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        SendErrorPayload? body = await response.Content.ReadFromJsonAsync<SendErrorPayload>(JsonOpts, cts.Token);
        Assert.NotNull(body);
        Assert.Equal("Forbidden — sender \"unregistered-agent\" is not a registered agent", body.Error);
        Assert.Null(body.Id);
        Assert.Equal("error", body.Status);

        // ── Assertion 2 — negative control: port file present → NOT 403 ──────
        string portFile = Path.Combine(factory.DiscoveryDir, "unregistered-agent.port");
        await File.WriteAllTextAsync(portFile, "9999", cts.Token);

        HttpResponseMessage registeredResponse = await http.PostAsJsonAsync("/send", request, JsonOpts, cts.Token);

        Assert.NotEqual(HttpStatusCode.Forbidden, registeredResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, registeredResponse.StatusCode);

        File.Delete(portFile);
    }

    private static readonly System.Text.Json.JsonSerializerOptions JsonOpts =
        new(System.Text.Json.JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

    private sealed record SendRequestPayload(string From, string To, string Body, string Type);
    private sealed record SendErrorPayload(string Error, string? Id, string Status);
}
