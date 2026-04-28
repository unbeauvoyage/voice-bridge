using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace VoiceBridge.Features.Compose;

/// <summary>
/// Process-wide ActivitySource + Meter for the /compose pipeline. Registered
/// once on the OpenTelemetry tracer/meter providers in
/// <c>VoiceBridge/Program.cs</c> via explicit
/// <c>ConfigureOpenTelemetryTracerProvider</c> /
/// <c>ConfigureOpenTelemetryMeterProvider</c> calls (see CoS observability
/// addendum: ServiceDefaults' implicit AddSource(ApplicationName) is fragile
/// under test entry-point overrides).
/// <para/>
/// Parent activity wraps the handler. Child activities — <c>compose.transcribe</c>,
/// <c>compose.upload</c>, <c>compose.relay</c> — wrap the orchestration calls
/// so the dashboard shows compose.transcribe → http.post (whisper) as
/// parent → child (the HttpClient auto-instrumentation supplies the http.post
/// span).
/// </summary>
internal static class ComposeTelemetry
{
    public const string SourceName = "VoiceBridge";

    public static readonly ActivitySource ActivitySource = new(SourceName);

    public static readonly Meter Meter = new(SourceName);

    public static readonly Counter<long> ComposeRequests =
        Meter.CreateCounter<long>("compose_requests_total");

    public static readonly Histogram<double> ComposeDurationMs =
        Meter.CreateHistogram<double>("compose_duration_ms");
}
