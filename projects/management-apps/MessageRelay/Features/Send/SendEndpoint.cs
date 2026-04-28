using Microsoft.Extensions.DependencyInjection.Extensions;

namespace MessageRelay.Features.Send;

/// <summary>
/// Wires the <c>POST /send</c> endpoint and registers <see cref="TimeProvider"/>
/// (used by <see cref="SendHandler"/> for the <c>ts</c> field on
/// <c>StoredMessage</c>). Spec: <c>paths./send</c>.
/// </summary>
internal static class SendEndpoint
{
    public static TBuilder AddSendFeature<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.Services.TryAddSingleton(TimeProvider.System);
        return builder;
    }

    public static IEndpointRouteBuilder MapSendFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapPost("/send", SendHandler.HandleAsync);
        return app;
    }
}
