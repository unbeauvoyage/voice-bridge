// User story: A test sender posts a message to "ceo" and the live dashboard
// WebSocket receives a `message` frame whose `data` matches the message that
// was sent. This proves the to=="ceo" branch of POST /send broadcasts to the
// /dashboard WebSocket — the contract documented in
// `message-relay/docs/openapi.yaml` (paths./send + components.schemas.DashboardMessageFrame).
//
// Real services: in-process WebApplicationFactory<Program> (real ASP.NET pipeline,
// real /send handler, real /dashboard WS upgrade, real broadcaster). No mocks.

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

        // When: an HTTP client POSTs to /send with to="ceo".
        using HttpClient http = factory.CreateClient();

        SendRequestPayload request = new(From: "test-sender", To: "ceo", Body: "hello dashboard", Type: "message");
        HttpResponseMessage httpResp = await http.PostAsJsonAsync("/send", request, JsonOpts, testCts.Token);

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
