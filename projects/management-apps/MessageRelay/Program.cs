using BackendShared;

using MessageRelay.Features.Agents;
using MessageRelay.Features.Channels;
using MessageRelay.Features.Dashboard;
using MessageRelay.Features.Events;
using MessageRelay.Features.Health;
using MessageRelay.Features.History;
using MessageRelay.Features.Raw;
using MessageRelay.Features.Send;
using MessageRelay.Features.Status;
using MessageRelay.Features.Version;
using MessageRelay.Middleware;
using MessageRelay.Telemetry;

using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.AddBackendDefaults();
builder.AddDashboardFeature();
builder.AddSendFeature();

// Custom OTel source + meter for the /send vertical slice. ServiceDefaults
// already configures AspNetCore + HttpClient + Runtime instrumentation; we
// layer the relay-specific Source/Meter on top so spans + counters flow
// through the same OTLP exporter (and the Prometheus exporter below).
//
// Explicit Configure*Provider calls (per chief-of-staff 2026-04-29) — content-
// service-dotnet found that the implicit `AddSource(ApplicationName)` baked
// into ServiceDefaults is fragile under Tests.AppHost rename: ApplicationName
// drifts and the custom Source / Meter never get sampled. Registering by
// literal name is belt-and-suspenders for in-process integration tests.
builder.Services.ConfigureOpenTelemetryTracerProvider(tracer =>
    tracer.AddSource(RelayTelemetry.ServiceName));
builder.Services.ConfigureOpenTelemetryMeterProvider(meter =>
    meter
        .AddMeter(RelayTelemetry.ServiceName)
        .AddPrometheusExporter());

WebApplication app = builder.Build();
app.UseWebSockets();
app.UseRelaySecretGuard();

// NOTE: MapDefaultEndpoints() is intentionally omitted — its /health shape
// (plain-text ASP.NET Health Checks) conflicts with the relay-specific JSON
// shape { ok, relay, port, host, clients, uptime }. HealthEndpoint owns /health.

// Prometheus text-format exposition at GET /metrics — parity with the TS
// sibling's `relay_sends_total` / `relay_queue_depth_total` metrics surface.
app.MapPrometheusScrapingEndpoint();

// Endpoint registrations live in Features/<FeatureName>/<FeatureName>Endpoint.cs
// as static extension methods on IEndpointRouteBuilder. Wire them here, one
// line per feature. See CLAUDE.md for the vertical-slice convention.
app.MapHealthFeature();
app.MapStatusFeature();
app.MapAgentsFeature();
app.MapChannelsFeature();
app.MapVersionFeature();
app.MapHistoryFeature();
app.MapRawFeature();
app.MapEventsFeature();
app.MapActivityFeature();
app.MapDashboardFeature();
app.MapSendFeature();

await app.RunAsync();

namespace MessageRelay
{
    /// <summary>
    /// Marker so <c>WebApplicationFactory&lt;Program&gt;</c> in MessageRelay.StoryTests
    /// can find the entry point. Must be public — xunit forces test classes public,
    /// and a public test class fixture cannot reference an internal Program.
    /// </summary>
    [System.Diagnostics.CodeAnalysis.SuppressMessage(
        "Design", "CA1515",
        Justification = "WebApplicationFactory<Program> in MessageRelay.StoryTests requires Program to be public; xunit forces test classes public, so Program cannot be internal+InternalsVisibleTo.")]
    public partial class Program;
}
