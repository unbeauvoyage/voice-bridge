// User story: POST /send without the X-Relay-Secret header is rejected with
// 401 Unauthorized when RELAY_SECRET is configured on the relay.
//
// When RELAY_SECRET is unset the relay runs unauthenticated (dev default).
// When it is set, every request to a protected path (/send, /status) must
// carry the matching header — absence is as wrong as a wrong value.
//
// Two assertions:
//   1. POST without the header → 401 + {"error": "Unauthorized — ..."} body.
//   2. Negative control: POST with the correct header → NOT 401 (200 OK).
//      Proves the 401 is header-gated, not always-on.
//
// Real services: in-process WebApplicationFactory<Program>. The factory sets
// RELAY_SECRET so the auth middleware activates.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.Send;

public sealed class MissingSecretRejected : IClassFixture<SecuredRelayWebAppFactory>
{
    private readonly SecuredRelayWebAppFactory factory;

    public MissingSecretRejected(SecuredRelayWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task PostWithoutSecretHeaderIsRejectedWith401()
    {
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        SendRequestPayload request = new(
            From: "ceo",
            To: "some-agent",
            Body: "hello",
            Type: "message");

        // ── Assertion 1 — no header → 401 ────────────────────────────────────
        HttpResponseMessage noHeaderResp = await http.PostAsJsonAsync("/send", request, JsonOpts, cts.Token);

        Assert.Equal(HttpStatusCode.Unauthorized, noHeaderResp.StatusCode);

        Auth401Payload? body = await noHeaderResp.Content.ReadFromJsonAsync<Auth401Payload>(JsonOpts, cts.Token);
        Assert.NotNull(body);
        Assert.Equal("Unauthorized — X-Relay-Secret header required", body.Error);

        // ── Assertion 2 — negative control: correct header → NOT 401 ─────────
        using HttpRequestMessage withHeader = new(HttpMethod.Post, "/send");
        withHeader.Headers.Add("X-Relay-Secret", SecuredRelayWebAppFactory.TestSecret);
        withHeader.Content = JsonContent.Create(request, options: JsonOpts);

        HttpResponseMessage withHeaderResp = await http.SendAsync(withHeader, cts.Token);

        Assert.NotEqual(HttpStatusCode.Unauthorized, withHeaderResp.StatusCode);
        Assert.Equal(HttpStatusCode.OK, withHeaderResp.StatusCode);
    }

    private static readonly System.Text.Json.JsonSerializerOptions JsonOpts =
        new(System.Text.Json.JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

    private sealed record SendRequestPayload(string From, string To, string Body, string Type);
    private sealed record Auth401Payload(string Error);
}
