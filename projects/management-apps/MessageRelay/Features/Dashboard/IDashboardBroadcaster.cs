using MessageRelay.Wire;

namespace MessageRelay.Features.Dashboard;

/// <summary>
/// Push channel for <c>/dashboard</c> WebSocket subscribers. Implementations
/// are singletons; both <see cref="DashboardEndpoint"/> (subscriber registry)
/// and <c>SendHandler</c> (publisher) reach the broadcaster through DI.
/// </summary>
internal interface IDashboardBroadcaster
{
    /// <summary>Register a WebSocket so it receives broadcast frames until <see cref="Unsubscribe"/>.</summary>
    public Guid Subscribe(System.Net.WebSockets.WebSocket socket);

    /// <summary>Stop pushing frames to the subscriber identified by <paramref name="id"/>.</summary>
    public void Unsubscribe(Guid id);

    /// <summary>Broadcast a <c>DashboardMessageFrame</c> (<c>{ type:"message", data:&lt;message&gt; }</c>) to every subscriber.</summary>
    public Task BroadcastMessageAsync(StoredMessage message, CancellationToken cancellationToken);

    /// <summary>Current count of connected WebSocket subscribers.</summary>
    public int ClientCount { get; }
}
