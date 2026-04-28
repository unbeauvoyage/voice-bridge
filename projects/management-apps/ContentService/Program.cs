using BackendShared;
using ContentService;
using ContentService.Features.GetFile;
using ContentService.Features.Health;
using ContentService.Features.OpenApi;
using ContentService.Features.Upload;
using ContentService.Features.Version;
using Microsoft.AspNetCore.Http.Features;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.AddBackendDefaults();

// Register ContentService's custom ActivitySource + Meter with the OTel
// pipeline. ServiceDefaults already AddSource(ApplicationName) — making this
// redundant when ApplicationName == "ContentService" — but registering by
// the same constant the features emit on is more robust than relying on the
// ambient assembly name (e.g. test entry points override it). The Meter
// scope is NOT pre-registered by ServiceDefaults, so this call is the only
// thing keeping content-service custom counters from being dropped.
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(ContentServiceTelemetry.Name))
    .WithMetrics(metrics => metrics.AddMeter(ContentServiceTelemetry.Name));

// Reject bodies above 25 MB at the multipart parser level — before any
// handler buffering. Matches the TS sibling's `multipart limits: { fileSize: MAX_BYTES }`.
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 25L * 1024L * 1024L;
});

WebApplication app = builder.Build();
app.UseCors(BackendDefaults.CorsPolicyName);

// NOTE: We intentionally do NOT call MapDefaultEndpoints(). ServiceDefaults'
// implementation maps a text-body /health in development that would
// conflict with — and shadow — our content-service-specific JSON shape
// {status:"ok", service:"content-service"}. ceo-app's backend-toggle
// reads `service` to confirm which stack it's connected to, so the
// canonical Health feature owns /health here.
//
// Endpoint registrations live in Features/<FeatureName>/<FeatureName>Endpoint.cs
// as static extension methods on IEndpointRouteBuilder. One line per feature.
// See CLAUDE.md for the vertical-slice convention.
app.MapHealthFeature();
app.MapVersionFeature();
app.MapOpenApiFeature();
app.MapUploadFeature();
app.MapGetFileFeature();

await app.RunAsync();
