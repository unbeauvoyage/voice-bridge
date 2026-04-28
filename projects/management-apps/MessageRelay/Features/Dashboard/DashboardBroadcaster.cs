using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
using System.Net.WebSockets;
using System.Text.Json;

using MessageRelay.Wire;

using Microsoft.Extensions.Options;

namespace MessageRelay.Features.Dashboard;

[SuppressMessage("Performance", "CA1812", Justification = "Instantiated via DI in AddDashboardFeature.")]
internal sealed partial class DashboardBroadcaster : IDashboardBroadcaster
{
    private readonly ConcurrentDictionary<Guid, WebSocket> subscribers = new();
    private readonly JsonSerializerOptions jsonOptions;
    private readonly ILogger<DashboardBroadcaster> logger;

    public DashboardBroadcaster(
        IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions> httpJsonOptions,
        ILogger<DashboardBroadcaster> logger)
    {
        ArgumentNullException.ThrowIfNull(httpJsonOptions);
        ArgumentNullException.ThrowIfNull(logger);
        this.jsonOptions = httpJsonOptions.Value.SerializerOptions;
        this.logger = logger;
    }

    public Guid Subscribe(WebSocket socket)
    {
        ArgumentNullException.ThrowIfNull(socket);
        Guid id = Guid.NewGuid();
        this.subscribers[id] = socket;
        Log.Subscribed(this.logger, id, this.subscribers.Count);
        return id;
    }

    public void Unsubscribe(Guid id)
    {
        if (this.subscribers.TryRemove(id, out _))
        {
            Log.Unsubscribed(this.logger, id, this.subscribers.Count);
        }
    }

    public async Task BroadcastMessageAsync(StoredMessage message, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        DashboardFrame<StoredMessage> frame = new(Type: "message", Data: message);
        byte[] payload = JsonSerializer.SerializeToUtf8Bytes(frame, this.jsonOptions);

        // Snapshot to avoid mutation during iteration; Send is per-socket.
        KeyValuePair<Guid, WebSocket>[] snapshot = [.. this.subscribers];
        foreach (KeyValuePair<Guid, WebSocket> entry in snapshot)
        {
            WebSocket socket = entry.Value;
            if (socket.State != WebSocketState.Open)
            {
                this.subscribers.TryRemove(entry.Key, out _);
                continue;
            }
            try
            {
                await socket.SendAsync(
                    payload,
                    WebSocketMessageType.Text,
                    endOfMessage: true,
                    cancellationToken).ConfigureAwait(false);
            }
            catch (WebSocketException ex)
            {
                Log.SendFailed(this.logger, entry.Key, ex);
                this.subscribers.TryRemove(entry.Key, out _);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
        }
    }

    private static partial class Log
    {
        [LoggerMessage(EventId = 100, Level = LogLevel.Debug, Message = "dashboard subscriber connected: {SubscriberId} (total={TotalSubscribers})")]
        public static partial void Subscribed(ILogger logger, Guid subscriberId, int totalSubscribers);

        [LoggerMessage(EventId = 101, Level = LogLevel.Debug, Message = "dashboard subscriber disconnected: {SubscriberId} (total={TotalSubscribers})")]
        public static partial void Unsubscribed(ILogger logger, Guid subscriberId, int totalSubscribers);

        [LoggerMessage(EventId = 102, Level = LogLevel.Warning, Message = "dashboard send failed for {SubscriberId} — evicting")]
        public static partial void SendFailed(ILogger logger, Guid subscriberId, Exception exception);
    }
}
