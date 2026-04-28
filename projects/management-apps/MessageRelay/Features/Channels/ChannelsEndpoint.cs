using System.Text.Json.Serialization;
using MessageRelay.Wire;

namespace MessageRelay.Features.Channels;

/// <summary>
/// GET /channels — port-file registered channels.
/// Shape: <c>{ channels: [{ agent, port }] }</c>.
/// Mirrors <c>handleChannels</c> in <c>routes/channels.ts</c>.
/// </summary>
internal static class ChannelsEndpoint
{
    public static IEndpointRouteBuilder MapChannelsFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapGet("/channels", HandleAsync);
        return app;
    }

    private static async Task<IResult> HandleAsync(
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        string dir = DiscoveryDirectory.Resolve(configuration);
        IReadOnlyList<DiscoveryDirectory.PortEntry> entries =
            await DiscoveryDirectory.ListPortEntriesAsync(dir, cancellationToken).ConfigureAwait(false);

        List<ChannelInfo> channels = new(entries.Count);
        foreach (DiscoveryDirectory.PortEntry entry in entries)
        {
            channels.Add(new ChannelInfo(entry.Agent, entry.Port));
        }

        return Results.Json(new ChannelsResponse(channels));
    }

    private sealed record ChannelInfo(
        [property: JsonPropertyName("agent")] string Agent,
        [property: JsonPropertyName("port")] int Port);

    private sealed record ChannelsResponse([property: JsonPropertyName("channels")] List<ChannelInfo> Channels);
}
