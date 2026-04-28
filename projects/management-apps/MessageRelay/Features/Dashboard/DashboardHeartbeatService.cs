using System.Diagnostics.CodeAnalysis;

namespace MessageRelay.Features.Dashboard;

[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by DI via AddHostedService in AddDashboardFeature.")]
internal sealed class DashboardHeartbeatService : BackgroundService
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(30);
    private readonly IDashboardBroadcaster broadcaster;

    public DashboardHeartbeatService(IDashboardBroadcaster broadcaster)
    {
        ArgumentNullException.ThrowIfNull(broadcaster);
        this.broadcaster = broadcaster;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using PeriodicTimer timer = new(HeartbeatInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
        {
            this.broadcaster.EvictDeadClients();
        }
    }
}
