using BackendShared;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using VoiceBridge.Features.Compose;
using VoiceBridge.Features.Compose.Clients;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.AddBackendDefaults();

// Register the compose pipeline's ActivitySource + Meter on the OTel
// providers so the Aspire dashboard auto-collects spans + metrics.
builder.Services.ConfigureOpenTelemetryTracerProvider(tracer =>
    tracer.AddSource(ComposeTelemetry.SourceName));
builder.Services.ConfigureOpenTelemetryMeterProvider(meter =>
    meter.AddMeter(ComposeTelemetry.SourceName));

// TimeProvider for testable timestamps. ComposeHandler reads UtcNow via this.
builder.Services.AddSingleton(TimeProvider.System);

// Typed HTTP clients per upstream. BaseAddress comes from env vars injected
// by AppHost (or test fixture): WHISPER_URL, CONTENT_SERVICE_URL, RELAY_URL.
string whisperUrl = builder.Configuration["WHISPER_URL"]
    ?? throw new InvalidOperationException("WHISPER_URL must be configured");
string contentServiceUrl = builder.Configuration["CONTENT_SERVICE_URL"]
    ?? throw new InvalidOperationException("CONTENT_SERVICE_URL must be configured");
string relayUrl = builder.Configuration["RELAY_URL"]
    ?? throw new InvalidOperationException("RELAY_URL must be configured");

builder.Services.AddHttpClient<IWhisperClient, WhisperClient>(client =>
    client.BaseAddress = new Uri(whisperUrl, UriKind.Absolute));
builder.Services.AddHttpClient<IContentServiceClient, ContentServiceClient>(client =>
    client.BaseAddress = new Uri(contentServiceUrl, UriKind.Absolute));
builder.Services.AddHttpClient<IRelaySendClient, RelaySendClient>(client =>
    client.BaseAddress = new Uri(relayUrl, UriKind.Absolute));

builder.Services.AddScoped<ComposeHandler>();

WebApplication app = builder.Build();
app.MapDefaultEndpoints();
app.MapComposeFeature();

await app.RunAsync();
