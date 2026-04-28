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
        "node",
        workingDirectory: "../message-relay",
        "--watch", "--require", "tsx/cjs", "src/relay-lean.ts")
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

// content-service (Bun + Fastify). File-content store for ceo-app — clipboard images,
// screenshots. Storage at ~/.claude/content/ with sha256 content-hash filenames.
// Reads PORT env. isProxied:false binds 8770 directly so the URL handed to ceo-app
// matches the URL the browser will hit (no DCP proxy hop on the upload return URL).
// Declared before voice-bridge-server so the variable is in scope for WaitFor/WithEnvironment.
var contentService = builder.AddExecutable(
        "content-service",
        "bun",
        workingDirectory: "../content-service",
        "--hot", "run", "src/index.ts")
    .WithHttpEndpoint(port: 8770, name: "http", env: "PORT", isProxied: false)
    .WithExternalHttpEndpoints()
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "content-service")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithHttpHealthCheck("/health");

// voice-bridge2 server (Bun). Reads PORT from env, so env-injection works.
// --hot enables Bun hot-module-reload for dev-time iteration.
// WaitFor(whisper) ensures whisper-server is bound before voice-bridge accepts audio.
// WaitFor(contentService) + CONTENT_SERVICE_URL wires the content store for attachment uploads.
var voiceBridgeServer = builder.AddExecutable(
        "voice-bridge-server",
        "bun",
        workingDirectory: "../voice-bridge2",
        "run", "--hot", "server/index.ts")
    .WithHttpEndpoint(port: 3030, name: "http", env: "PORT")
    .WithExternalHttpEndpoints()
    .WaitFor(relay)
    .WaitFor(whisper)
    .WaitFor(contentService)
    .WithEnvironment("CONTENT_SERVICE_URL", contentService.GetEndpoint("http"))
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

// ─── .NET backend experiment ─────────────────────────────────────────────────
// PascalCase siblings to the kebab-case TS services. Strive for feature parity;
// TS is canonical. AddProject<>() + WithExplicitStart() means each resource is
// visible in the Aspire dashboard but NOT started automatically — ceo-app's
// settings toggle (Task #13) flips RELAY_URL_TS ↔ RELAY_URL_DOTNET (etc.) at
// runtime and starts the .NET sibling on demand.
//
// Ports come from each project's Properties/launchSettings.json — Aspire
// auto-discovers them as the endpoint named "http". MessageRelay :8768,
// VoiceBridge :3031, ContentService :8771 (all TS-port +1).
// WithExternalHttpEndpoints exposes the discovered endpoint to the host so
// ceo-app's browser bundle can hit it directly via the GetEndpoint("http") URL.

var relayDotnet = builder.AddProject<Projects.MessageRelay>("relay-dotnet")
    .WithExternalHttpEndpoints()
    .WithExplicitStart();

var voiceBridgeDotnet = builder.AddProject<Projects.VoiceBridge>("voice-bridge-dotnet")
    .WithExternalHttpEndpoints()
    .WithExplicitStart();

var contentServiceDotnet = builder.AddProject<Projects.ContentService>("content-service-dotnet")
    .WithExternalHttpEndpoints()
    .WithExplicitStart();

// ceo-app dev server (React Router / Vite via Bun). Vite respects --port flag
// but not PORT env, so we pass --port 5175 as args. isProxied: false prevents
// DCP from allocating a second port — the process binds 5175 directly.
// Health check uses "/" — Vite dev server returns 200 at root when ready.
// OTEL_EXPORTER_OTLP_ENDPOINT is read by vite.config.ts and mirrored to
// VITE_OTEL_EXPORTER_OTLP_ENDPOINT so the browser bundle picks it up at
// build time. The browser OTel SDK in app/otel.ts then sends OTLP/HTTP
// to the Aspire dashboard. CORS must be allowed — see appsettings.Development.json
// ASPIRE_DASHBOARD_OTLP__CORS__ALLOWEDORIGINS.
//
// Dual backend URLs: ceo-app sees both TS and .NET URLs at startup so the
// settings toggle (Task #13) can flip between them at runtime without an
// AppHost restart. Existing single-name vars (CONTENT_SERVICE_URL, VOICE_BRIDGE_URL)
// kept as TS-aliases for backward-compat with code already reading them; new
// code SHOULD read the explicit *_TS / *_DOTNET pair.
builder.AddExecutable(
        "ceo-app",
        "bun",
        workingDirectory: "../ceo-app",
        "run", "dev", "--", "--port", "5175")
    .WithHttpEndpoint(port: 5175, name: "http", isProxied: false)
    .WithExternalHttpEndpoints()
    .WaitFor(relay)
    .WaitFor(contentService)
    .WaitFor(voiceBridgeServer)
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "ceo-app")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithEnvironment("CONTENT_SERVICE_URL", contentService.GetEndpoint("http"))
    .WithEnvironment("VOICE_BRIDGE_URL", voiceBridgeServer.GetEndpoint("http"))
    .WithEnvironment("RELAY_URL_TS", relay.GetEndpoint("http"))
    .WithEnvironment("RELAY_URL_DOTNET", relayDotnet.GetEndpoint("http"))
    .WithEnvironment("VOICE_BRIDGE_URL_TS", voiceBridgeServer.GetEndpoint("http"))
    .WithEnvironment("VOICE_BRIDGE_URL_DOTNET", voiceBridgeDotnet.GetEndpoint("http"))
    .WithEnvironment("CONTENT_SERVICE_URL_TS", contentService.GetEndpoint("http"))
    .WithEnvironment("CONTENT_SERVICE_URL_DOTNET", contentServiceDotnet.GetEndpoint("http"))
    .WithHttpHealthCheck("/");

builder.Build().Run();
