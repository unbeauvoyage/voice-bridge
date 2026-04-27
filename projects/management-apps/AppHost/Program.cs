var builder = DistributedApplication.CreateBuilder(args);

// Read the OTLP HTTP endpoint from this process's environment (injected by launchSettings
// via DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL). "http" profile → http://localhost:18890,
// "https" profile → https://localhost:18891. Passing this through to AddExecutable resources
// as OTEL_EXPORTER_OTLP_ENDPOINT because the Node/Bun OTel SDK reads the standard env var
// while DCP only injects DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL automatically for .NET
// projects. otel.ts files also read DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL directly as
// a belt-and-suspenders fallback.
var otlpEndpoint = Environment.GetEnvironmentVariable("DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL")
    ?? "http://localhost:18890";

// AppHost:OtlpApiKey is stored in dotnet user-secrets (run `dotnet user-secrets list`).
// Aspire DCP sets DASHBOARD__OTLP__AUTHMODE=ApiKey for the dashboard, so non-.NET
// AddExecutable resources must include the key in every OTLP request header.
// OTEL_EXPORTER_OTLP_HEADERS format: "key=value,key2=value2".
var otlpApiKey = builder.Configuration["AppHost:OtlpApiKey"] ?? "";
var otlpHeaders = otlpApiKey.Length > 0 ? $"x-otlp-api-key={otlpApiKey}" : "";

// message-relay — lean relay (Bun). DCP allocates an internal port, injects it
// via LEAN_RELAY_PORT, and proxies external 8767 → that internal port.
// --hot enables Bun hot-module-reload: source file changes reload modules in-place
// without a full process restart (dev-time convenience; in-memory state resets on reload).
// NOTE: Aspire 13.2.4 has no public restart-policy API for AddExecutable resources.
// DCP's ExecutableSpec.restartPolicy field exists in the binary but is not exposed
// via C#. Wrap in a shell loop or upgrade to a version that adds WithRestartPolicy
// if auto-respawn on crash is needed.
var relay = builder.AddExecutable(
        "relay",
        "bun",
        workingDirectory: "../message-relay",
        "run", "--hot", "src/relay-lean.ts")
    .WithHttpEndpoint(port: 8767, name: "http", env: "LEAN_RELAY_PORT")
    .WithExternalHttpEndpoints()
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "relay")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithHttpHealthCheck("/health");

// whisper-server (whisper.cpp). Binds 127.0.0.1:8766 directly; isProxied: false
// prevents DCP from allocating a second port — the process owns 8766.
// No /health endpoint — health check polls root "/" which returns 200 when ready.
var whisper = builder.AddExecutable(
        "whisper-server",
        "whisper-server",
        workingDirectory: "../message-relay",
        "--model", "models/ggml-medium.bin",
        "--host", "127.0.0.1",
        "--port", "8766",
        "--language", "auto",
        "--translate")
    .WithHttpEndpoint(port: 8766, name: "http", isProxied: false)
    .WithExternalHttpEndpoints()
    .WithHttpHealthCheck("/");

// voice-bridge2 server (Bun). Reads PORT from env, so env-injection works.
// --hot enables Bun hot-module-reload for dev-time iteration.
// WaitFor(whisper) ensures whisper-server is bound before voice-bridge accepts audio.
var voiceBridgeServer = builder.AddExecutable(
        "voice-bridge-server",
        "bun",
        workingDirectory: "../voice-bridge2",
        "run", "--hot", "server/index.ts")
    .WithHttpEndpoint(port: 3030, name: "http", env: "PORT")
    .WithExternalHttpEndpoints()
    .WaitFor(relay)
    .WaitFor(whisper)
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "voice-bridge-server")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithHttpHealthCheck("/health");

// wake-word daemon (Python). No HTTP endpoint — listens for wake phrase only.
// --target chief-of-staff matches CEO's running config.
builder.AddExecutable(
        "wake-word",
        "python3",
        workingDirectory: "../voice-bridge2/daemon",
        "wake_word.py",
        "--server", "http://127.0.0.1:3030",
        "--target", "chief-of-staff",
        "--start-threshold", "0.3",
        "--stop-threshold", "0.15")
    .WaitFor(voiceBridgeServer);

// voice-bridge2 Electron window. No HTTP endpoint (Electron opens a window,
// not a port). electron-vite picks its own renderer port.
builder.AddExecutable(
        "voice-bridge-electron",
        "bun",
        workingDirectory: "../voice-bridge2",
        "run", "dev")
    .WaitFor(voiceBridgeServer);

// ceo-app dev server (React Router / Vite via Bun). Vite respects --port flag
// but not PORT env, so we pass --port 5175 as args. isProxied: false prevents
// DCP from allocating a second port — the process binds 5175 directly.
// Health check uses "/" — Vite dev server returns 200 at root when ready.
// OTEL_EXPORTER_OTLP_ENDPOINT is read by vite.config.ts and mirrored to
// VITE_OTEL_EXPORTER_OTLP_ENDPOINT so the browser bundle picks it up at
// build time. The browser OTel SDK in app/otel.ts then sends OTLP/HTTP
// to the Aspire dashboard. CORS must be allowed — see appsettings.Development.json
// ASPIRE_DASHBOARD_OTLP__CORS__ALLOWEDORIGINS.
builder.AddExecutable(
        "ceo-app",
        "bun",
        workingDirectory: "../ceo-app",
        "run", "dev", "--", "--port", "5175")
    .WithHttpEndpoint(port: 5175, name: "http", isProxied: false)
    .WithExternalHttpEndpoints()
    .WaitFor(relay)
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "ceo-app")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithHttpHealthCheck("/");

builder.Build().Run();
