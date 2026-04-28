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
    private readonly ConcurrentDictionary<Guid, (WebSocket Socket, string? FromIdentity)> subscribers = new();
    private readonly ConcurrentDictionary<string, Guid> namedClients = new(StringComparer.Ordinal);
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

    public Guid Subscribe(WebSocket socket, string? fromIdentity)
    {
        ArgumentNullException.ThrowIfNull(socket);
        Guid id = Guid.NewGuid();

        if (fromIdentity is not null)
        {
            // Hold the lock for the full evict-old + register-new sequence so that
            // two concurrent connects with the same fromIdentity cannot both win the
            // TryRemove and leave a stale subscriber entry in the dictionary.
            lock (this.namedClients)
            {
                if (this.namedClients.TryRemove(fromIdentity, out Guid existingId))
                {
                    if (this.subscribers.TryRemove(existingId, out (WebSocket Socket, string? FromIdentity) existing))
                    {
                        try { existing.Socket.Abort(); }
                        catch (ObjectDisposedException) { }
                        Log.EvictedNamed(this.logger, fromIdentity, existingId);
                    }
                }
                this.subscribers[id] = (socket, fromIdentity);
                this.namedClients[fromIdentity] = id;
            }
        }
        else
        {
            this.subscribers[id] = (socket, null);
        }

        Log.Subscribed(this.logger, id, this.subscribers.Count);
        return id;
    }

    public void Unsubscribe(Guid id)
    {
        if (this.subscribers.TryRemove(id, out (WebSocket Socket, string? FromIdentity) entry))
        {
            if (entry.FromIdentity is not null)
            {
                this.namedClients.TryRemove(new KeyValuePair<string, Guid>(entry.FromIdentity, id));
            }
            Log.Unsubscribed(this.logger, id, this.subscribers.Count);
        }
    }

    public int ClientCount => this.subscribers.Count;

    public async Task BroadcastMessageAsync(StoredMessage message, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        DashboardFrame<StoredMessage> frame = new(Type: "message", Data: message);
        byte[] payload = JsonSerializer.SerializeToUtf8Bytes(frame, this.jsonOptions);
        await this.BroadcastPayloadAsync(payload, cancellationToken).ConfigureAwait(false);
    }

    public async Task BroadcastActivityAsync(ActivityFrame data, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(data);
        DashboardFrame<ActivityFrame> frame = new(Type: "activity", Data: data);
        byte[] payload = JsonSerializer.SerializeToUtf8Bytes(frame, this.jsonOptions);
        await this.BroadcastPayloadAsync(payload, cancellationToken).ConfigureAwait(false);
    }

    public void EvictDeadClients()
    {
        foreach (KeyValuePair<Guid, (WebSocket Socket, string? FromIdentity)> entry in this.subscribers)
        {
            bool isDead;
            try { isDead = entry.Value.Socket.State != WebSocketState.Open; }
            catch (ObjectDisposedException) { isDead = true; }

            if (isDead)
            {
                this.subscribers.TryRemove(entry.Key, out _);
                if (entry.Value.FromIdentity is not null)
                {
                    this.namedClients.TryRemove(new KeyValuePair<string, Guid>(entry.Value.FromIdentity, entry.Key));
                }
            }
        }
    }

    private async Task BroadcastPayloadAsync(byte[] payload, CancellationToken cancellationToken)
    {
        KeyValuePair<Guid, (WebSocket Socket, string? FromIdentity)>[] snapshot = [.. this.subscribers];
        if (snapshot.Length == 0) { return; }
        await Task.WhenAll(Array.ConvertAll(
            snapshot,
            entry => this.SendToOneAsync(entry.Key, entry.Value.Socket, payload, cancellationToken)))
            .ConfigureAwait(false);
    }

    private async Task SendToOneAsync(Guid id, WebSocket socket, byte[] payload, CancellationToken cancellationToken)
    {
        bool isDead;
        try { isDead = socket.State != WebSocketState.Open; }
        catch (ObjectDisposedException) { isDead = true; }

        if (isDead)
        {
            this.subscribers.TryRemove(id, out _);
            return;
        }
        try
        {
            await socket.SendAsync(payload, WebSocketMessageType.Text, endOfMessage: true, cancellationToken).ConfigureAwait(false);
        }
        catch (WebSocketException ex)
        {
            Log.SendFailed(this.logger, id, ex);
            this.subscribers.TryRemove(id, out _);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
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

        [LoggerMessage(EventId = 103, Level = LogLevel.Debug, Message = "evicted named client {FromIdentity}/{ExistingId} on reconnect")]
        public static partial void EvictedNamed(ILogger logger, string fromIdentity, Guid existingId);
    }
}
