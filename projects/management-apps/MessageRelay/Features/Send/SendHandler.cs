using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

using MessageRelay.Features.Dashboard;
using MessageRelay.Telemetry;
using MessageRelay.Wire;

namespace MessageRelay.Features.Send;

/// <summary>
/// Routing logic for <c>POST /send</c>. Implements validation, sender-registry
/// 403 guard, the <c>to == "ceo"</c> broadcast branch, and the non-ceo stub.
/// Spec: <c>paths./send</c>.
/// </summary>
internal static partial class SendHandler
{
    private const string CeoRecipient = "ceo";
    private const string StatusDelivered = "delivered";
    private const string StatusFailed = "failed";
    private const string StatusError = "error";

    private const string RouteBroadcast = "broadcast";
    private const string RoutePlugin = "plugin";
    private const string RouteValidation = "validation";
    private const string RouteAuth = "auth";

    /// <summary>Always-include serializer for SendError responses (id is required-but-nullable per spec).</summary>
    private static readonly JsonSerializerOptions ErrorJsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    public static async Task<IResult> HandleAsync(
        SendRequest? request,
        HttpContext httpContext,
        IDashboardBroadcaster broadcaster,
        TimeProvider timeProvider,
        IConfiguration configuration,
        ILogger<SendRequestMarker> logger,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(httpContext);
        ArgumentNullException.ThrowIfNull(broadcaster);
        ArgumentNullException.ThrowIfNull(timeProvider);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(logger);

        using Activity? activity = RelayTelemetry.Source.StartActivity("send", ActivityKind.Server);

        if (request is null)
        {
            return ValidationError(activity, "Missing request body");
        }

        // Resolve the wire-default for `type` once and thread it through —
        // both the activity-tag step and the enum-validity check need it.
        string type = request.Type ?? MessageType.Message;

        IResult? validationFailure = ValidateAndTag(request, type, activity);
        if (validationFailure is not null)
        {
            return validationFailure;
        }

        string? discoveryDir = configuration["RELAY_DISCOVERY_DIR"];
        if (!SenderRegistry.IsAllowed(request.From, discoveryDir))
        {
            string senderIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
            await QuarantineLog.AppendAsync(
                configuration["LOG_DIR"], request.From, request.To, type, senderIp, timeProvider, cancellationToken).ConfigureAwait(false);
            return SenderForbidden(activity, request.From, request.To, logger);
        }

        string id = Guid.NewGuid().ToString();
        string ts = timeProvider.GetUtcNow().ToString("o", CultureInfo.InvariantCulture);

        if (string.Equals(request.To, CeoRecipient, StringComparison.Ordinal))
        {
            StoredMessage message = new(id, request.From, request.To, request.Body, type, ts, true);
            await broadcaster.BroadcastMessageAsync(message, cancellationToken).ConfigureAwait(false);
            TagOutcome(activity, RouteBroadcast, StatusDelivered);
            Log.CeoBroadcast(logger, id, request.From);
            return Results.Ok(new SendResponse(Id: id, Status: StatusDelivered));
        }

        TagOutcome(activity, RoutePlugin, StatusFailed);
        Log.AgentDeliveryNotImplemented(logger, id, request.To);
        return Results.Ok(new SendResponse(Id: id, Status: StatusFailed, Error: "agent delivery not yet implemented in dotnet sibling"));
    }

    private static IResult? ValidateAndTag(SendRequest request, string type, Activity? activity)
    {
        activity?.SetTag("relay.from", request.From);
        activity?.SetTag("relay.to", request.To);
        activity?.SetTag("relay.type", type);

        if (!AgentName.IsValid(request.From))
        {
            return ValidationError(activity, $"Invalid sender: {request.From}");
        }

        if (!AgentName.IsValid(request.To))
        {
            return ValidationError(activity, $"Invalid recipient: {request.To}");
        }

        if (string.Equals(request.From, request.To, StringComparison.Ordinal))
        {
            return ValidationError(activity, "Cannot send to self");
        }

        if (!MessageType.IsValid(type))
        {
            return ValidationError(activity, $"Invalid type: {type}");
        }

        if (string.IsNullOrEmpty(request.Body))
        {
            return ValidationError(activity, "Body must be non-empty");
        }

        return null;
    }

    private static IResult ValidationError(Activity? activity, string message)
    {
        activity?.SetTag("relay.route", RouteValidation);
        activity?.SetTag("relay.outcome", StatusError);
        activity?.SetStatus(ActivityStatusCode.Error, message);
        RelayTelemetry.SendsTotal.Add(
            1,
            new KeyValuePair<string, object?>("status", StatusError),
            new KeyValuePair<string, object?>("route", RouteValidation));

        return Results.Json(
            new SendError(Error: message, Id: null, Status: StatusError),
            ErrorJsonOptions,
            statusCode: StatusCodes.Status400BadRequest);
    }

    private static IResult SenderForbidden(
        Activity? activity,
        string from,
        string to,
        ILogger<SendRequestMarker> logger)
    {
        string message = $"Forbidden — sender \"{from}\" is not a registered agent";
        activity?.SetTag("relay.route", RouteAuth);
        activity?.SetTag("relay.outcome", StatusError);
        activity?.SetStatus(ActivityStatusCode.Error, message);
        RelayTelemetry.SendsTotal.Add(
            1,
            new KeyValuePair<string, object?>("status", StatusError),
            new KeyValuePair<string, object?>("route", RouteAuth));
        Log.SenderNotRegistered(logger, from, to);
        return Results.Json(
            new SendError(Error: message, Id: null, Status: StatusError),
            ErrorJsonOptions,
            statusCode: StatusCodes.Status403Forbidden);
    }

    private static void TagOutcome(Activity? activity, string route, string status)
    {
        activity?.SetTag("relay.route", route);
        activity?.SetTag("relay.outcome", status);
        RelayTelemetry.SendsTotal.Add(
            1,
            new KeyValuePair<string, object?>("status", status),
            new KeyValuePair<string, object?>("route", route));
    }

    /// <summary>Marker type for <see cref="ILogger{TCategoryName}"/> — keeps the category name stable.</summary>
    [SuppressMessage("Performance", "CA1812", Justification = "ILogger<T> category marker — never instantiated directly; resolved by the framework.")]
    internal sealed class SendRequestMarker;

    private static partial class Log
    {
        [LoggerMessage(EventId = 200, Level = LogLevel.Information, Message = "send: ceo broadcast id={MessageId} from={From}")]
        public static partial void CeoBroadcast(ILogger logger, string messageId, string from);

        [LoggerMessage(EventId = 201, Level = LogLevel.Warning, Message = "send: agent delivery not implemented id={MessageId} to={To}")]
        public static partial void AgentDeliveryNotImplemented(ILogger logger, string messageId, string to);

        [LoggerMessage(EventId = 202, Level = LogLevel.Warning, Message = "send: sender not registered from={From} to={To}")]
        public static partial void SenderNotRegistered(ILogger logger, string from, string to);
    }
}
