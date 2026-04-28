// Test-only AppHost. Wires ONLY the voice-bridge-dotnet project — no whisper,
// no relay, no content-service, no ceo-app, no Bun/Python/Electron. Used by
// the xunit story tests via DistributedApplicationTestingBuilder<
// Projects.VoiceBridge_Tests_AppHost>.
//
// RELAY_URL, WHISPER_URL, CONTENT_SERVICE_URL are forwarded from the test
// fixture's IConfiguration as environment variables so each test class
// can route /compose's upstream calls at the peers it wants — TS peers
// today (CEO directive Q5(C) plan), .NET peers tomorrow via env-var flip,
// no test code change.
//
// This file is intentionally NOT inside the strict-regime path glob —
// AppHost projects use loose SDK defaults (see .editorconfig comment about
// AppHost/ServiceDefaults exclusions).

// Default peer URLs target the canonical TS-stack ports (relay-ts :8767,
// whisper :8766, content-service-ts :8770) per CEO directive Q5(C). The
// fixture overrides these via builder.Configuration in InitializeAsync()
// before BuildAsync(); the WithEnvironment callback below resolves the
// final URL at start-time, so post-CreateAsync overrides flow through.
IDistributedApplicationBuilder builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.VoiceBridge>("voice-bridge-dotnet")
    .WithEnvironment(ctx =>
    {
        // RelayUrl / WhisperUrl / ContentServiceUrl are populated by ComposeFixture
        // via DistributedApplicationTestingBuilder's shared IConfiguration (in-process
        // only — a separate-process AppHost would not see these keys).
        ctx.EnvironmentVariables["RELAY_URL"] =
            builder.Configuration["RelayUrl"] ?? "http://127.0.0.1:8767";
        ctx.EnvironmentVariables["WHISPER_URL"] =
            builder.Configuration["WhisperUrl"] ?? "http://127.0.0.1:8766";
        ctx.EnvironmentVariables["CONTENT_SERVICE_URL"] =
            builder.Configuration["ContentServiceUrl"] ?? "http://127.0.0.1:8770";
    });

await builder.Build().RunAsync();
