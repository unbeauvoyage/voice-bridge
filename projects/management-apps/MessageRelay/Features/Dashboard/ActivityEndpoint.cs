using System.Text.Json.Serialization;

using MessageRelay.Wire;

namespace MessageRelay.Features.Dashboard;

internal static class ActivityEndpoint
{
    public static IEndpointRouteBuilder MapActivityFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapPost("/activity", HandleAsync);
        return app;
    }

    private static async Task<IResult> HandleAsync(
        ActivityRequest? request,
        IDashboardBroadcaster broadcaster,
        CancellationToken cancellationToken)
    {
        if (request?.Name is not string name || !AgentName.IsValid(name))
        {
            return Results.Json(new ErrorBody("Invalid agent name"), statusCode: StatusCodes.Status400BadRequest);
        }

        string ts = request.Ts ?? DateTimeOffset.UtcNow.ToString("o");
        ActivityFrame frame = new(
            Name: name,
            Backend: request.Backend ?? "claude",
            State: request.State ?? string.Empty,
            Detail: request.Detail,
            Ts: ts);

        await broadcaster.BroadcastActivityAsync(frame, cancellationToken).ConfigureAwait(false);
        return Results.NoContent();
    }

    private sealed record ErrorBody([property: JsonPropertyName("error")] string Error);
}
