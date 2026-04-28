# AppHost — .NET Aspire Orchestrator

Orchestrates the full TS + .NET stack under a single `dotnet run` command. The
dashboard surfaces both stacks side-by-side; ceo-app's settings toggle picks
which backend each browser SDK call hits at runtime.

## How to run

```sh
cd management-apps
dotnet run --project AppHost
```

Aspire boots both stacks in dependency order and prints the dashboard URL to
stdout. The .NET stack auto-starts (no `WithExplicitStart()` since 2026-04-29
per CEO directive — the runtime toggle requires both sides to be live).

## Dashboard

http://localhost:18888

Shows live status, logs, and OTel traces/metrics for every resource.

## Services

| Resource | Stack | Command | Port |
|---|---|---|---|
| `relay-ts` | TS | `node --watch tsx/cjs src/relay-lean.ts` | 8767 |
| `relay-dotnet` | .NET | `dotnet run` (MessageRelay) | 8768 |
| `whisper-server` | binary | `whisper-server …` | 8766 |
| `content-service-ts` | TS | `bun --hot run src/index.ts` | 8770 |
| `content-service-dotnet` | .NET | `dotnet run` (ContentService) | 8771 |
| `voice-bridge-ts` | TS | `bun run --hot server/index.ts` | 3030 |
| `voice-bridge-dotnet` | .NET | `dotnet run` (VoiceBridge) | 8773 |
| `wake-word` | Python | `python3 daemon/wake_word.py` | — |
| `voice-bridge-electron` | Electron | `bun run dev` | — |
| `ceo-app` | TS | `bun run dev --port 5175` | 5175 |

TS ports are the historic values; .NET ports cluster in the 877x band
(8768/8771/8773) so `lsof` and the Aspire dashboard show them next to each
other. Both stacks expose the same wire contract (`docs/openapi.yaml` is
linked byte-identical between TS and .NET in each service); ceo-app's hey-api
SDKs flip base URLs at runtime via the backend store.

## Backend toggle

ceo-app's `/settings` page has a per-service toggle (relay, voice-bridge,
content-service) plus a master toggle. AppHost emits both URLs to ceo-app:

```
RELAY_URL_TS / RELAY_URL_DOTNET
VOICE_BRIDGE_URL_TS / VOICE_BRIDGE_URL_DOTNET
CONTENT_SERVICE_URL_TS / CONTENT_SERVICE_URL_DOTNET
```

`vite.config.ts` mirrors each as a `VITE_*_BASE_TS` / `_DOTNET` browser define;
`app/shared/config.ts` exports the constants; `app/stores/backend.ts` (Zustand)
holds the active stack; `app/hey-api*.ts` consumes `getActive*Base()` to pick
the URL at SDK-call time. Switching is instant — no AppHost restart needed.

## OTel

Aspire injects `DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL` into all child
processes; AppHost re-exports it as `OTEL_EXPORTER_OTLP_ENDPOINT` for the
Bun/Node SDK and as `OTEL_EXPORTER_OTLP_HEADERS` (with the dashboard's API
key) so non-.NET services can authenticate to the OTLP receiver. See
`appsettings.Development.json` for the dashboard's CORS / API-key config.

## Adding a new C# project

Create the project alongside AppHost and ServiceDefaults, reference it from
`Program.cs`:

```csharp
var api = builder.AddProject<Projects.ApiService>("api")
    .WithExternalHttpEndpoints()
    .WaitFor(relayTs);
```

Pin the dev port via `Properties/launchSettings.json` (Aspire auto-discovers
the `http` profile's `applicationUrl`); add an `AddBackendDefaults()` call at
the top of the new project's `Program.cs` for the camelCase JSON +
ProblemDetails wiring shared across all .NET services.
