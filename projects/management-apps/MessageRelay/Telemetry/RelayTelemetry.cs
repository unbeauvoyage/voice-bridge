using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace MessageRelay.Telemetry;

/// <summary>
/// Per-service ActivitySource + Meter. Both are registered with
/// OpenTelemetry in <c>Program.cs</c> (<c>AddSource</c>/<c>AddMeter</c>) so
/// custom spans + counters flow through the same OTLP exporter the
/// ServiceDefaults pipeline already configured.
/// </summary>
internal static class RelayTelemetry
{
    /// <summary>OpenTelemetry Source / Meter name. Used by Aspire's dashboard to scope traces + metrics.</summary>
    public const string ServiceName = "MessageRelay";

    public static readonly ActivitySource Source = new(ServiceName);

    public static readonly Meter Meter = new(ServiceName);

    /// <summary>Per-outcome send counter. Mirrors <c>relay_sends_total</c> exposed by the TypeScript sibling.</summary>
    public static readonly Counter<long> SendsTotal = Meter.CreateCounter<long>(
        name: "relay_sends_total",
        unit: "{messages}",
        description: "Total messages routed by POST /send, tagged by status (delivered|failed|error).");
}
