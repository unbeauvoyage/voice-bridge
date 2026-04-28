// User story: POST /send with an incorrect X-Relay-Secret value is rejected
// with 401 Unauthorized, even when the header is present.
//
// The check uses a timing-safe comparison (CryptographicOperations.FixedTimeEquals)
// so a wrong value — even one differing by a single byte — is indistinguishable
// from a missing header from the attacker's perspective.
//
// Two assertions:
//   1. POST with wrong secret → 401 + {"error": "Unauthorized — ..."} body.
//   2. Negative control: POST with the correct secret → NOT 401 (200 OK).
//      Proves the 401 is value-discriminating, not always-on.
//
// Real services: in-process WebApplicationFactory<Program> with RELAY_SECRET set.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.Send;

public sealed class WrongSecretRejected : IClassFixture<SecuredRelayWebAppFactory>
{
    private readonly SecuredRelayWebAppFactory factory;

    public WrongSecretRejected(SecuredRelayWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task PostWithWrongSecretIsRejectedWith401()
    {
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        SendRequestPayload request = new(
            From: "ceo",
            To: "some-agent",
            Body: "hello",
            Type: "message");

        // ── Assertion 1 — wrong header value → 401 ───────────────────────────
        using HttpRequestMessage wrongSecretReq = new(HttpMethod.Post, "/send");
        wrongSecretReq.Headers.Add("X-Relay-Secret", "definitely-not-the-right-secret");
        wrongSecretReq.Content = JsonContent.Create(request, options: JsonOpts);

        HttpResponseMessage wrongResp = await http.SendAsync(wrongSecretReq, cts.Token);

        Assert.Equal(HttpStatusCode.Unauthorized, wrongResp.StatusCode);

        Auth401Payload? body = await wrongResp.Content.ReadFromJsonAsync<Auth401Payload>(JsonOpts, cts.Token);
        Assert.NotNull(body);
        Assert.Equal("Unauthorized — X-Relay-Secret header required", body.Error);

        // ── Assertion 2 — negative control: correct secret → NOT 401 ─────────
        using HttpRequestMessage correctSecretReq = new(HttpMethod.Post, "/send");
        correctSecretReq.Headers.Add("X-Relay-Secret", SecuredRelayWebAppFactory.TestSecret);
        correctSecretReq.Content = JsonContent.Create(request, options: JsonOpts);

        HttpResponseMessage correctResp = await http.SendAsync(correctSecretReq, cts.Token);

        Assert.NotEqual(HttpStatusCode.Unauthorized, correctResp.StatusCode);
        Assert.Equal(HttpStatusCode.OK, correctResp.StatusCode);
    }

    private static readonly System.Text.Json.JsonSerializerOptions JsonOpts =
        new(System.Text.Json.JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

    private sealed record SendRequestPayload(string From, string To, string Body, string Type);
    private sealed record Auth401Payload(string Error);
}
