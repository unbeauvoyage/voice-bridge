using System.Net.WebSockets;

namespace MessageRelay.Features.Dashboard;

/// <summary>
/// Wires the <c>GET /dashboard</c> WebSocket endpoint and registers
/// <see cref="IDashboardBroadcaster"/> for publishers (<c>SendHandler</c>).
/// Spec: <c>paths./dashboard</c> + <c>components.schemas.DashboardFrame</c>.
/// </summary>
internal static partial class DashboardEndpoint
{
    public static TBuilder AddDashboardFeature<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.Services.AddSingleton<IDashboardBroadcaster, DashboardBroadcaster>();
        return builder;
    }

    public static IEndpointRouteBuilder MapDashboardFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/dashboard", HandleAsync);
        return app;
    }

    private static async Task HandleAsync(
        HttpContext context,
        IDashboardBroadcaster broadcaster,
        ILogger<DashboardBroadcaster> logger,
        CancellationToken cancellationToken)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        using WebSocket socket = await context.WebSockets.AcceptWebSocketAsync().ConfigureAwait(false);
        Guid subscriberId = broadcaster.Subscribe(socket);
        try
        {
            await DrainUntilClosedAsync(socket, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            // Server shutting down or client disconnected via cancellation.
        }
        catch (WebSocketException ex)
        {
            Log.ReceiveFailed(logger, subscriberId, ex);
        }
        finally
        {
            broadcaster.Unsubscribe(subscriberId);
        }
    }

    private static async Task DrainUntilClosedAsync(WebSocket socket, CancellationToken cancellationToken)
    {
        byte[] buffer = new byte[1024];
        while (socket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            WebSocketReceiveResult result = await socket
                .ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken)
                .ConfigureAwait(false);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await socket
                    .CloseAsync(WebSocketCloseStatus.NormalClosure, "client closed", cancellationToken)
                    .ConfigureAwait(false);
                return;
            }
            // Server-push only — discard any inbound frames silently.
        }
    }

    private static partial class Log
    {
        [LoggerMessage(EventId = 110, Level = LogLevel.Debug, Message = "dashboard receive failed for {SubscriberId}")]
        public static partial void ReceiveFailed(ILogger logger, Guid subscriberId, Exception exception);
    }
}
