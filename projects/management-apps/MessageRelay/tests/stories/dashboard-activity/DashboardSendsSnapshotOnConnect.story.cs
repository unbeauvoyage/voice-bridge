// User story: CEO's dashboard page connects to GET /dashboard (WebSocket).
// relay-dotnet must immediately send a snapshot frame with { type:"snapshot",
// data:{ sessions:[] } } on connect, before any other frame.
//
// Negative control: type must equal "snapshot" — any other value (e.g.
// "message", "activity") proves the wrong frame was sent first.

using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.DashboardActivity;

public sealed class DashboardSendsSnapshotOnConnect : IClassFixture<DashboardActivityWebAppFactory>
{
    private readonly DashboardActivityWebAppFactory factory;

    public DashboardSendsSnapshotOnConnect(DashboardActivityWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task ConnectingToDashboardReceivesSnapshotFrameFirst()
    {
        // Given: relay-dotnet is running and no prior sessions exist.
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));
        UriBuilder wsUri = new(this.factory.Server.BaseAddress)
        {
            Scheme = "ws",
            Path = "/dashboard",
        };

        // When: CEO's browser connects to /dashboard.
        WebSocket ws = await this.factory.Server
            .CreateWebSocketClient()
            .ConnectAsync(wsUri.Uri, cts.Token);

        // Then: the first frame is a snapshot with an empty sessions array.
        byte[] buffer = new byte[4096];
        ValueWebSocketReceiveResult result = await ws.ReceiveAsync(
            new Memory<byte>(buffer), cts.Token);

        string json = Encoding.UTF8.GetString(buffer, 0, result.Count);
        SnapshotFrame? frame = JsonSerializer.Deserialize<SnapshotFrame>(json);

        Assert.NotNull(frame);
        Assert.Equal("snapshot", frame.Type);
        Assert.NotNull(frame.Data);
        Assert.NotNull(frame.Data.Sessions);
        Assert.Empty(frame.Data.Sessions);

        // Negative control: any other frame type proves a different frame arrived first.
        Assert.NotEqual("message", frame.Type);
        Assert.NotEqual("activity", frame.Type);

        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", cts.Token);
    }

    private sealed record SnapshotFrame(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("data")] SnapshotFrameData Data);

    private sealed record SnapshotFrameData(
        [property: JsonPropertyName("sessions")] JsonElement[] Sessions);
}
