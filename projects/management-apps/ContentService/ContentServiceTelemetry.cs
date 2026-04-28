using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace ContentService;

/// <summary>
/// Shared telemetry primitives for ContentService features. The framework
/// wiring (OTLP exporter, sampler, resource attributes) is inherited via
/// <c>AddBackendDefaults()</c> / ServiceDefaults — what lives here is the
/// domain-specific custom Activity + Meter that every feature emits to.
/// <para/>
/// Centralizing the names guarantees a stable wire contract for the OTel
/// collector + dashboard: filtering on <c>service.name=ContentService</c>
/// and <c>scope=ContentService</c> picks up every upload and fetch span
/// without per-feature coupling.
/// </summary>
internal static class ContentServiceTelemetry
{
    public const string Name = "ContentService";

    public static readonly ActivitySource Source = new(Name);

    public static readonly Meter Meter = new(Name);

    /// <summary>Count of successful uploads, tagged by <c>mime</c>.</summary>
    public static readonly Counter<long> UploadsTotal =
        Meter.CreateCounter<long>("content_uploads_total");

    /// <summary>Bytes actually written to disk (skipped on dedup hits), tagged by <c>mime</c>.</summary>
    public static readonly Counter<long> BytesStored =
        Meter.CreateCounter<long>("content_bytes_stored_total");

    /// <summary>Uploads that hashed to a SHA-256 already on disk, tagged by <c>mime</c>.</summary>
    public static readonly Counter<long> DedupHits =
        Meter.CreateCounter<long>("content_dedup_hits_total");
}
