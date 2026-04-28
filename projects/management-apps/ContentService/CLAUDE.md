# ContentService (.NET)

**Sibling of `content-service/` (TypeScript). TS is canonical; this service strives for feature parity, never invents its own contract.**

The TS content-service defines the wire contract via its OpenAPI surface (PUT `/content`, GET `/content/{sha256}`). This .NET service must match exactly: same paths, same SHA-256 keying, same content-addressed storage at `~/.claude/content/`. Spec mismatches mean TS is right and this service is wrong.

## Port

`http://localhost:8771` (TS sibling is :8770; .NET is +1). AppHost emits both URLs as env vars to ceo-app (`CONTENT_SERVICE_URL_TS`, `CONTENT_SERVICE_URL_DOTNET`); ceo-app's settings toggle picks one.

## Architecture — vertical slice

**Routes do not live in `Program.cs`.** Each feature owns its folder under `Features/`:

```
ContentService/
├── Program.cs                          (composition root only — ~10 lines)
├── Features/
│   ├── PutContent/
│   │   ├── PutContentEndpoint.cs       (static class; MapPutContentFeature extension)
│   │   ├── PutContentRequest.cs        (multipart binding)
│   │   ├── PutContentResponse.cs       (record { sha256, url })
│   │   └── PutContentHandler.cs        (writes to disk, returns content-hash URL)
│   └── GetContent/
│       ├── GetContentEndpoint.cs
│       └── GetContentHandler.cs        (streams the file at sha256)
└── …
```

Each `<Feature>Endpoint.cs` exposes one extension method on `IEndpointRouteBuilder`:

```csharp
public static IEndpointRouteBuilder MapPutContentFeature(this IEndpointRouteBuilder app)
{
    app.MapPut("/content", PutContentHandler.HandleAsync).DisableAntiforgery();
    return app;
}
```

`Program.cs` then wires features one line each.

If you find yourself adding `app.MapPut(...)` directly in `Program.cs`, **move it into a feature folder before you commit**.

## Strict rules (compile-level)

Inherited from `BackendShared/Backends.props` + repo-root `.editorconfig`. Same set as MessageRelay — see `MessageRelay/CLAUDE.md` for the full list. Banned: `dynamic`, `var` (loose), `as` (dangerous form), null-forgiving `!`. Every warning is an error.

## Storage convention

`~/.claude/content/` — content-addressed by SHA-256 of file bytes. Filename is the hex digest (no extension). Same as TS sibling. PUT returns `{ sha256, url }` where `url` is `${CONTENT_SERVICE_URL}/content/${sha256}`.

The .NET sibling MUST use the same on-disk layout so a TS write is readable by the .NET service and vice versa. The toggle in ceo-app should be invisible to the user; both services are interchangeable readers/writers of the same store.

## What lives where

- `BackendShared/` — `AddBackendDefaults()` extension; wire-format conventions on top of Aspire's `AddServiceDefaults()`.
- `ServiceDefaults/` — Aspire's blessed defaults: OTel, /health, resilience, service discovery.
- `Features/<Name>/` — your code; static endpoint extensions; handlers as plain methods.

## Testing

User story tests only. `tests/stories/<feature>/<scenario>.story.cs`. Real upload via real HTTP client; assert SHA-256 round-trip; verify on-disk filename matches TS sibling's layout. No mocks of the SUT.

## Restart after edits

`dotnet watch run` hot-reloads. AppHost relaunch picks up code changes after the next DCP cycle. Never tell the CEO to restart.
