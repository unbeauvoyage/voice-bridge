# VoiceBridge (.NET)

**Sibling of `voice-bridge2/` (TypeScript). TS is canonical; this service strives for feature parity, never invents its own contract.**

The TS voice-bridge defines the wire contract for `/compose`, `/transcribe`, `/agents`, `/mic`, `/settings`, `/wake-word`, `/target`. This .NET service must match. Spec mismatches mean TS is right and this service is wrong.

(The kebab-case folder is `voice-bridge2`, hence the legacy `2`. The .NET port drops the suffix — fresh start, no reason to carry it.)

## Port

`http://localhost:3031` (TS sibling is :3030; .NET is +1). AppHost emits both URLs as env vars to ceo-app (`VOICE_BRIDGE_URL_TS`, `VOICE_BRIDGE_URL_DOTNET`); ceo-app's settings toggle picks one.

## Architecture — vertical slice

**Routes do not live in `Program.cs`.** Each feature owns its folder under `Features/`:

```
VoiceBridge/
├── Program.cs                          (composition root only — ~10 lines)
├── Features/
│   ├── Compose/
│   │   ├── ComposeEndpoint.cs          (static class; MapComposeFeature extension)
│   │   ├── ComposeRequest.cs           (record)
│   │   ├── ComposeResponse.cs          (record)
│   │   └── ComposeHandler.cs           (handler logic; testable)
│   ├── Transcribe/                     (kept until Phase C of TS-side cleanup completes)
│   ├── Agents/                         (relay-derived agent list)
│   ├── Mic/                            (mic device enumeration)
│   ├── Settings/                       (singleton key/value store for daemon state)
│   ├── WakeWord/                       (settings + status of wake-word daemon)
│   └── Target/                         (current routing target agent)
└── …
```

Each `<Feature>Endpoint.cs` exposes one extension method on `IEndpointRouteBuilder`:

```csharp
public static IEndpointRouteBuilder MapComposeFeature(this IEndpointRouteBuilder app)
{
    app.MapPost("/compose", ComposeHandler.HandleAsync);
    return app;
}
```

`Program.cs` then wires features one line each.

If you find yourself adding `app.MapPost(...)` directly in `Program.cs`, **move it into a feature folder before you commit**.

## Strict rules (compile-level)

Inherited from `BackendShared/Backends.props` + repo-root `.editorconfig`. Same set as MessageRelay — see `MessageRelay/CLAUDE.md` for the full list. Banned: `dynamic`, `var` (loose), `as` (dangerous form), null-forgiving `!`. Every warning is an error.

## What lives where

- `BackendShared/` — `AddBackendDefaults()` extension; wire-format conventions on top of Aspire's `AddServiceDefaults()`.
- `ServiceDefaults/` — Aspire's blessed defaults: OTel, /health, resilience, service discovery.
- `Features/<Name>/` — your code; static endpoint extensions; handlers as plain methods.

## External dependencies

The TS voice-bridge calls:
- `whisper-server` (whisper.cpp) at `http://127.0.0.1:8766` for transcription
- `message-relay` at the relay URL for delivering composed messages
- `content-service` for attachment uploads

The .NET sibling needs the same wiring. AppHost will inject `WHISPER_URL`, `RELAY_URL`, `CONTENT_SERVICE_URL` env vars — read them via `IConfiguration` in handlers.

## Testing

User story tests only. `tests/stories/<feature>/<scenario>.story.cs`. Real whisper-server, real relay, real content-service. No mocks of the SUT.

## Restart after edits

`dotnet watch run` hot-reloads. AppHost relaunch picks up code changes after the next DCP cycle. Never tell the CEO to restart.
