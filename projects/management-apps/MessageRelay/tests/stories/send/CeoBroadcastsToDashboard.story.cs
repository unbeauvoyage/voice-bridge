// User story: POST /send broadcasts a `message` frame to /dashboard ONLY when
// to == "ceo". For any other recipient, the broadcast path must NOT fire.
//
// Two assertions in one story (per reviewer 2026-04-29 — path-discriminating
// negative control):
//   1. Non-ceo POST (to="isolated-agent") → no /dashboard frame within 500ms.
//      This proves the routing branch is the discriminator, not the body or
//      any other field. (A test that only checks the ceo path could pass with
//      the same assertions even if the broadcaster fired unconditionally.)
//   2. Ceo POST (to="ceo") → /dashboard receives `{type:"message", data:<msg>}`
//      whose body, id, etc. match the request.
//
// Real services: in-process WebApplicationFactory<Program> (real ASP.NET
// pipeline, real /send handler, real /dashboard WS upgrade, real broadcaster).
// No mocks of the SUT.

using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

using Microsoft.AspNetCore.TestHost;

using Xunit;

namespace MessageRelay.StoryTests.Send;

public sealed class CeoBroadcastsToDashboard : IClassFixture<RelayWebAppFactory>
{
    private readonly RelayWebAppFactory factory;

    public CeoBroadcastsToDashboard(RelayWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task CeoSendBroadcastsMessageFrameToDashboard()
    {
        // Given: a connected /dashboard WebSocket subscriber.
        WebSocketClient wsClient = factory.Server.CreateWebSocketClient();
        Uri dashboardUri = new(factory.Server.BaseAddress, "/dashboard");

        using CancellationTokenSource testCts = new(TimeSpan.FromSeconds(10));
        using WebSocket dashboard = await wsClient.ConnectAsync(dashboardUri, testCts.Token);

        // Drain the snapshot frame /dashboard sends immediately on connect —
        // it must not count as the "rogue broadcast" in the race assertion below.
        byte[] snapshotBuf = new byte[4096];
        await dashboard.ReceiveAsync(new ArraySegment<byte>(snapshotBuf), testCts.Token);

        using HttpClient http = factory.CreateClient();

        // ── Assertion 1 — path-discriminating negative control ─────────────────
        // Non-ceo POST must not produce a /dashboard frame.
        await AssertNonCeoDoesNotBroadcastAsync(http, dashboard, testCts.Token);

        // ── Assertion 2 — happy path: ceo POST broadcasts a matching frame ─────
        SendRequestPayload request = new(
            From: "test-sender",
            To: "ceo",
            Body: "hello dashboard",
            Type: "message");
        HttpResponseMessage httpResp = await http.PostAsJsonAsync(
            "/send", request, JsonOpts, testCts.Token);

        // Then: HTTP returns 200 + delivered with a UUID id.
        Assert.Equal(HttpStatusCode.OK, httpResp.StatusCode);
        SendResponsePayload? sendBody = await httpResp.Content.ReadFromJsonAsync<SendResponsePayload>(JsonOpts, testCts.Token);
        Assert.NotNull(sendBody);
        Assert.Equal("delivered", sendBody.Status);
        Assert.True(Guid.TryParse(sendBody.Id, CultureInfo.InvariantCulture, out Guid sendId));
        Assert.NotEqual(Guid.Empty, sendId);

        // And: the dashboard WebSocket receives a `message` frame whose payload matches.
        DashboardFramePayload frame = await ReceiveJsonFrameAsync(dashboard, testCts.Token);
        Assert.Equal("message", frame.Type);
        Assert.NotNull(frame.Data);

        StoredMessagePayload data = frame.Data;
        Assert.Equal(sendBody.Id, data.Id);
        Assert.Equal("test-sender", data.From);
        Assert.Equal("ceo", data.To);
        Assert.Equal("hello dashboard", data.Body);
        Assert.Equal("message", data.Type);
        Assert.True(data.Delivered);

        // ts must parse as a recent UTC timestamp.
        Assert.True(DateTimeOffset.TryParse(
            data.Ts,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out DateTimeOffset ts));
        TimeSpan age = DateTimeOffset.UtcNow - ts;
        Assert.InRange(age.TotalSeconds, -5, 60);

        await dashboard.CloseAsync(WebSocketCloseStatus.NormalClosure, "test done", testCts.Token);
    }

    /// <summary>
    /// Path-discriminating negative control: POST /send with a non-ceo recipient
    /// and assert no /dashboard frame arrives within 500ms. Race a delay against
    /// a WebSocket receive; the delay must win. Cancels the dangling receive so
    /// the next caller can ReceiveAsync the WebSocket cleanly.
    /// </summary>
    private static async Task AssertNonCeoDoesNotBroadcastAsync(
        HttpClient http, WebSocket dashboard, CancellationToken testToken)
    {
        SendRequestPayload nonCeoRequest = new(
            From: "test-sender",
            To: "isolated-agent",
            Body: "should-not-broadcast",
            Type: "message");
        HttpResponseMessage nonCeoResp = await http.PostAsJsonAsync(
            "/send", nonCeoRequest, JsonOpts, testToken);
        Assert.Equal(HttpStatusCode.OK, nonCeoResp.StatusCode);

        using CancellationTokenSource rogueCts = CancellationTokenSource.CreateLinkedTokenSource(testToken);
        byte[] rogueBuffer = new byte[1024];
        Task<WebSocketReceiveResult> rogueReceive = dashboard.ReceiveAsync(
            new ArraySegment<byte>(rogueBuffer), rogueCts.Token);
        Task delay = Task.Delay(TimeSpan.FromMilliseconds(500), rogueCts.Token);
        Task firstCompleted = await Task.WhenAny(rogueReceive, delay);
        Assert.Same(delay, firstCompleted);

        await rogueCts.CancelAsync();
        try
        {
            await rogueReceive;
        }
        catch (OperationCanceledException)
        {
            // expected — we cancelled the dangling receive after the delay won.
        }
    }

    private static async Task<DashboardFramePayload> ReceiveJsonFrameAsync(WebSocket ws, CancellationToken ct)
    {
        byte[] buffer = new byte[16 * 1024];
        StringBuilder accumulated = new();
        while (true)
        {
            WebSocketReceiveResult result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                throw new InvalidOperationException("WebSocket closed before a frame arrived");
            }
            accumulated.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
            if (result.EndOfMessage)
            {
                break;
            }
        }
        DashboardFramePayload? parsed = JsonSerializer.Deserialize<DashboardFramePayload>(accumulated.ToString(), JsonOpts);
        Assert.NotNull(parsed);
        return parsed;
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private sealed record SendRequestPayload(string From, string To, string Body, string Type);
    private sealed record SendResponsePayload(string Id, string Status, string? Error);
    private sealed record DashboardFramePayload(string Type, StoredMessagePayload Data);
    private sealed record StoredMessagePayload(string Id, string From, string To, string Body, string Type, string Ts, bool Delivered);
}
