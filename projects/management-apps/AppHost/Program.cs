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

// ─── Stack-suffix naming convention ──────────────────────────────────────────
// Every backend service has BOTH a TS and a .NET sibling. Resource names carry
// an explicit stack suffix so the dashboard self-documents which stack each
// belongs to: relay-ts / relay-dotnet, voice-bridge-ts / voice-bridge-dotnet,
// content-service-ts / content-service-dotnet. whisper-server and the
// voice-bridge daemons (wake-word, voice-bridge-electron) have no .NET sibling
// and stay unsuffixed.

// ─── TS stack ────────────────────────────────────────────────────────────────

// message-relay (Bun → Node + tsx). DCP allocates an internal port, injects it
// via LEAN_RELAY_PORT, and proxies external 8767 → that internal port.
// --watch enables tsx watch-mode reload on source changes.
// NOTE: Aspire 13.2.4 has no public restart-policy API for AddExecutable
// resources — the underlying ExecutableSpec.restartPolicy field exists but is
// not exposed in C#. Wrap in a shell loop or upgrade if auto-respawn matters.
var relayTs = builder.AddExecutable(
        "relay-ts",
        "node",
        workingDirectory: "../message-relay",
        "--watch", "--require", "tsx/cjs", "src/relay-lean.ts")
    .WithHttpEndpoint(port: 8767, name: "http", env: "LEAN_RELAY_PORT")
    .WithExternalHttpEndpoints()
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "relay-ts")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithHttpHealthCheck("/health");

// whisper-server (whisper.cpp). Binds 127.0.0.1:8766 directly; isProxied: false
// prevents DCP from allocating a second port — the process owns 8766.
//
// Health check: GET /health returns {"status":"ok"} (200) once the model is
// loaded, {"status":"loading model"} (503) while still loading. ggml-medium.bin
// takes 30-60 s on first start — WaitFor(whisper) in downstream resources waits
// for this 200 before starting, so voice-bridge-{ts,dotnet} never receive audio
// before whisper is inference-ready. Do NOT change this to "/" — the root path
// responds as soon as the HTTP server binds (before the model loads), which
// gives a false-healthy signal.
//
// WHISPER_URL path note: AppHost injects the BASE URL only (e.g.
// "http://localhost:8766" — no trailing path). whisper.cpp serves inference at
// POST /inference and health at GET /health. Any client that receives
// WHISPER_URL MUST append the path explicitly; do not POST to BaseAddress.
// voice-bridge-ts does NOT receive WHISPER_URL from AppHost — it reads its own
// config.ts default (which already includes the path). voice-bridge-dotnet
// receives WHISPER_URL below; see WhisperClient.cs for the path append.
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
    .WithHttpHealthCheck("/health");

// content-service-ts (Bun + Fastify). File-content store for ceo-app — clipboard
// images, screenshots. Storage at ~/.claude/content/ with sha256 content-hash
// filenames. Reads PORT env. isProxied:false binds 8770 directly so the URL
// handed to ceo-app matches the URL the browser will hit (no DCP proxy hop on
// the upload-return URL). Declared before voice-bridge-ts so its variable is
// in scope for WaitFor + WithEnvironment.
var contentServiceTs = builder.AddExecutable(
        "content-service-ts",
        "bun",
        workingDirectory: "../content-service",
        "--hot", "run", "src/index.ts")
    .WithHttpEndpoint(port: 8770, name: "http", env: "PORT", isProxied: false)
    .WithExternalHttpEndpoints()
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "content-service-ts")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithHttpHealthCheck("/health");

// voice-bridge-ts (Bun → multimodal /compose orchestrator + /transcribe + agents/mic/settings).
// Reads PORT from env. --hot enables Bun hot-module-reload for dev-time iteration.
// WaitFor(whisper) ensures whisper is bound before voice-bridge accepts audio.
// WaitFor(contentServiceTs) + CONTENT_SERVICE_URL wires attachment uploads.
var voiceBridgeTs = builder.AddExecutable(
        "voice-bridge-ts",
        "bun",
        workingDirectory: "../voice-bridge2",
        "run", "--hot", "server/index.ts")
    .WithHttpEndpoint(port: 3030, name: "http", env: "PORT")
    .WithExternalHttpEndpoints()
    .WaitFor(relayTs)
    .WaitFor(whisper)
    .WaitFor(contentServiceTs)
    .WithEnvironment("CONTENT_SERVICE_URL", contentServiceTs.GetEndpoint("http"))
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "voice-bridge-ts")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithHttpHealthCheck("/health");

// wake-word daemon (Python). No HTTP endpoint — listens for the wake phrase.
// Currently pointed at voice-bridge-ts; when voice-bridge-dotnet reaches
// feature parity, the --server arg can become an env-driven setting that
// follows ceo-app's backend toggle.
builder.AddExecutable(
        "wake-word",
        "python3",
        workingDirectory: "../voice-bridge2/daemon",
        "wake_word.py",
        "--server", "http://127.0.0.1:3030",
        "--target", "chief-of-staff",
        "--start-threshold", "0.3",
        "--stop-threshold", "0.15")
    .WaitFor(voiceBridgeTs);

// voice-bridge-electron — Electron window for voice-bridge2. No HTTP endpoint.
// Pointed at voice-bridge-ts via in-process IPC + the daemon URL above.
builder.AddExecutable(
        "voice-bridge-electron",
        "bun",
        workingDirectory: "../voice-bridge2",
        "run", "dev")
    .WaitFor(voiceBridgeTs);

// ─── .NET stack ──────────────────────────────────────────────────────────────
// PascalCase project siblings (MessageRelay, VoiceBridge, ContentService) under
// management-apps/. Strive for feature parity with TS; TS is canonical.
//
// AddProject<>() + WithExplicitStart() means each resource is visible in the
// Aspire dashboard but NOT started automatically — ceo-app's settings toggle
// (Task #13) starts the .NET sibling on demand and flips its base URL via
// the *_TS / *_DOTNET env-var pair below.
//
// Ports come from each project's Properties/launchSettings.json — Aspire
// auto-discovers them as the endpoint named "http". MessageRelay :8768,
// VoiceBridge :3031, ContentService :8771 (all TS-port +1).
//
// Dependency graph mirrors the TS side: voice-bridge-dotnet WaitFor whisper,
// relay-dotnet, content-service-dotnet — keeps dashboard topology parallel.
// Cross-stack mixing (e.g., voice-bridge-dotnet → relay-ts) is possible by
// overriding env vars manually; the default wiring is fully-parallel.

var relayDotnet = builder.AddProject<Projects.MessageRelay>("relay-dotnet")
    .WithExternalHttpEndpoints()
    .WithExplicitStart();

var contentServiceDotnet = builder.AddProject<Projects.ContentService>("content-service-dotnet")
    .WithExternalHttpEndpoints()
    .WithExplicitStart();

var voiceBridgeDotnet = builder.AddProject<Projects.VoiceBridge>("voice-bridge-dotnet")
    .WithExternalHttpEndpoints()
    .WithExplicitStart()
    .WaitFor(relayDotnet)
    .WaitFor(whisper)
    .WaitFor(contentServiceDotnet)
    .WithEnvironment("RELAY_URL", relayDotnet.GetEndpoint("http"))
    // Base URL only — no path. WhisperClient must POST to /inference explicitly.
    // See whisper block comment above for the full WHISPER_URL path note.
    .WithEnvironment("WHISPER_URL", whisper.GetEndpoint("http"))
    .WithEnvironment("CONTENT_SERVICE_URL", contentServiceDotnet.GetEndpoint("http"));

// ─── ceo-app ─────────────────────────────────────────────────────────────────
// React Router / Vite via Bun. Vite respects --port flag but not PORT env, so
// we pass --port 5175 as args. isProxied: false prevents DCP from allocating
// a second port — the process binds 5175 directly.
//
// Health check uses "/" — Vite dev server returns 200 at root when ready.
// OTEL_EXPORTER_OTLP_ENDPOINT is read by vite.config.ts and mirrored to
// VITE_OTEL_EXPORTER_OTLP_ENDPOINT so the browser bundle picks it up at build
// time. The browser OTel SDK in app/otel.ts then sends OTLP/HTTP to the
// Aspire dashboard. CORS must be allowed — see appsettings.Development.json
// ASPIRE_DASHBOARD_OTLP__CORS__ALLOWEDORIGINS.
//
// Dual backend URLs: ceo-app sees both TS and .NET URLs at startup so the
// settings toggle (Task #13) can flip between them at runtime without an
// AppHost restart. Existing single-name vars (CONTENT_SERVICE_URL,
// VOICE_BRIDGE_URL) are kept as TS-aliases for backward-compat with code
// already reading them; new code SHOULD read the explicit *_TS / *_DOTNET pair.
builder.AddExecutable(
        "ceo-app",
        "bun",
        workingDirectory: "../ceo-app",
        "run", "dev", "--", "--port", "5175")
    .WithHttpEndpoint(port: 5175, name: "http", isProxied: false)
    .WithExternalHttpEndpoints()
    .WaitFor(relayTs)
    .WaitFor(contentServiceTs)
    .WaitFor(voiceBridgeTs)
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpEndpoint)
    .WithEnvironment("OTEL_EXPORTER_OTLP_HEADERS", otlpHeaders)
    .WithEnvironment("OTEL_SERVICE_NAME", "ceo-app")
    .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
    .WithEnvironment("CONTENT_SERVICE_URL", contentServiceTs.GetEndpoint("http"))
    .WithEnvironment("VOICE_BRIDGE_URL", voiceBridgeTs.GetEndpoint("http"))
    .WithEnvironment("RELAY_URL_TS", relayTs.GetEndpoint("http"))
    .WithEnvironment("RELAY_URL_DOTNET", relayDotnet.GetEndpoint("http"))
    .WithEnvironment("VOICE_BRIDGE_URL_TS", voiceBridgeTs.GetEndpoint("http"))
    .WithEnvironment("VOICE_BRIDGE_URL_DOTNET", voiceBridgeDotnet.GetEndpoint("http"))
    .WithEnvironment("CONTENT_SERVICE_URL_TS", contentServiceTs.GetEndpoint("http"))
    .WithEnvironment("CONTENT_SERVICE_URL_DOTNET", contentServiceDotnet.GetEndpoint("http"))
    .WithHttpHealthCheck("/");

builder.Build().Run();
