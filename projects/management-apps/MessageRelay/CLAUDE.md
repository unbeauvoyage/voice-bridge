# MessageRelay (.NET)

**Sibling of `message-relay/` (TypeScript). TS is canonical; this service strives for feature parity, never invents its own contract.**

The TS message-relay defines the wire contract via `message-relay/docs/openapi.yaml`. This .NET service must serve the same OpenAPI document byte-for-byte at `GET /openapi.yaml` once feature work begins. Spec mismatches mean the TS service is right and this service is wrong.

## Port

`http://localhost:8768` (TS sibling is :8767; .NET is +1). AppHost emits both URLs as env vars to ceo-app (`RELAY_URL_TS`, `RELAY_URL_DOTNET`); ceo-app's settings toggle picks one.

## Architecture — vertical slice

**Routes do not live in `Program.cs`.** Each feature owns its folder under `Features/`:

```
MessageRelay/
├── Program.cs                          (composition root only — ~10 lines)
├── Features/
│   ├── Send/
│   │   ├── SendEndpoint.cs             (static class; MapSendFeature extension)
│   │   ├── SendRequest.cs              (record; wire DTO)
│   │   ├── SendResponse.cs             (record)
│   │   └── SendHandler.cs              (handler logic; testable)
│   ├── Activity/
│   │   ├── ActivityEndpoint.cs
│   │   └── ActivityHandler.cs
│   ├── Dashboard/                      (WebSocket /dashboard)
│   └── Health/                         (extras beyond ServiceDefaults' /health)
└── …
```

Each `<Feature>Endpoint.cs` exposes one extension method on `IEndpointRouteBuilder`:

```csharp
public static IEndpointRouteBuilder MapSendFeature(this IEndpointRouteBuilder app)
{
    app.MapPost("/send", SendHandler.HandleAsync);
    return app;
}
```

`Program.cs` then wires features one line each:

```csharp
app.MapDefaultEndpoints();   // /health, /alive — from ServiceDefaults
app.MapSendFeature();
app.MapActivityFeature();
// …
```

If you find yourself adding `app.MapPost(...)` directly in `Program.cs`, **move it into a feature folder before you commit**.

## Strict rules (compile-level)

Inherited from `BackendShared/Backends.props` + repo-root `.editorconfig`:

- `<Nullable>enable</Nullable>` — every nullable warning is an error
- `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` — every warning fails the build
- `<AnalysisLevel>latest-all</AnalysisLevel>` + `<AnalysisMode>All</AnalysisMode>` — every CA analyzer enabled
- `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` — `.editorconfig` style violations fail the build
- `csharp_style_var_*_= false:error` — explicit types only; no loose `var` (analogue to TS ban on `any`)
- `dotnet_diagnostic.RCS1206.severity = error` — no dangerous `as` casts (analogue to TS ban on `as`)
- Null-forgiving `!` operator — banned in code review (no good analyzer; reviewers reject)
- `dynamic` — banned (analogue to TS `any`); reviewers reject

If a rule annoys you, change `Backends.props` / `.editorconfig` instead of disabling it locally. Per-file/per-line suppressions are a defect.

## What lives where

- `BackendShared/` — `AddBackendDefaults()` extension. Calls Aspire's `AddServiceDefaults()` then layers wire-format conventions (camelCase JSON, ProblemDetails, strict deserialization).
- `ServiceDefaults/` — Aspire's blessed defaults: OTel, /health, resilience, service discovery.
- `Features/<Name>/` — your code. One folder per feature; static endpoint extensions; handlers as plain methods.

## Testing

User story tests only (per repo CLAUDE.md). `<service>/tests/stories/<feature>/<scenario>.story.cs`. Real services, no mocks of the SUT, negative-control proven RED→GREEN. No unit tests, no mocks, no contract tests.

Test framework TBD when first feature lands. Likely `xunit.v3` + Microsoft.AspNetCore.Mvc.Testing for in-process integration; Playwright via `Microsoft.Playwright` for browser-driven stories.

## Restart after edits

`dotnet watch run` (run from this folder) hot-reloads on file changes. AppHost-managed: AppHost relaunch (`cd AppHost && dotnet run`) picks up code changes after the next DCP cycle. Never tell the CEO to restart — agents are responsible for restarts.
