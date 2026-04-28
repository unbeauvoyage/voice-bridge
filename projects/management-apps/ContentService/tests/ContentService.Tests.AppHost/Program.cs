// Test-only AppHost for ContentService stories. Wires:
//   - content-service-dotnet (the project under test, this repo's binary)
//   - content-service-ts     (the TS sibling at ../../../content-service)
//
// Both services point at the SAME CONTENT_DIR so the cross-stack story
// can upload via one stack and fetch via the other against shared disk
// state. CONTENT_DIR is forwarded from the test fixture's IConfiguration
// (key "ContentDir") so each test class gets a fresh temp dir and never
// touches the user's ~/.claude/content/.
//
// No whisper, no voice-bridge, no ceo-app, no Bun/Python tooling beyond
// what content-service-ts itself needs (bun runtime). HTTP ports are
// DCP-allocated dynamically so multiple test classes can run in parallel
// without binding-conflicts.
//
// This file is intentionally NOT inside the strict-regime path glob —
// AppHost projects use loose SDK defaults (see .editorconfig comment about
// AppHost/ServiceDefaults exclusions).

IDistributedApplicationBuilder builder = DistributedApplication.CreateBuilder(args);

string contentDir = builder.Configuration["ContentDir"]
    ?? throw new InvalidOperationException(
        "Test fixture must set configuration key 'ContentDir' to a writable temp path before building the AppHost.");

builder.AddProject<Projects.ContentService>("content-service-dotnet")
    .WithEnvironment("CONTENT_DIR", contentDir);

// The TS sibling. workingDirectory walks up from this AppHost's project
// directory: ContentService/tests/ContentService.Tests.AppHost/ →
// ContentService/tests/ → ContentService/ → management-apps/ →
// management-apps/content-service/. PORT env is bound dynamically by DCP.
builder.AddExecutable(
        "content-service-ts",
        "bun",
        workingDirectory: "../../../content-service",
        "run", "src/index.ts")
    .WithHttpEndpoint(env: "PORT")
    .WithEnvironment("CONTENT_DIR", contentDir);

await builder.Build().RunAsync();
