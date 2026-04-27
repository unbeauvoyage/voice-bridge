# AppHost — .NET Aspire Orchestrator

Orchestrates the management-apps Bun/Node services under a single `dotnet run` command.

## How to run

```sh
cd management-apps
dotnet run --project AppHost
```

Aspire boots all four services in dependency order and prints the dashboard URL to stdout.

## Dashboard

http://localhost:18888

Shows live status, logs, and traces for every service.

## Services

| Name | Command | Port |
|---|---|---|
| relay | `bun run src/relay-lean.ts` | 8767 |
| voice-bridge | `bun run server/index.ts` | 3030 |
| wake-word | `python3 daemon/wake_word.py` | — |
| ceo-app | `bun run dev` | 5173 |

## Future: adding a C# API

Create a new project (e.g. `ApiService/ApiService.csproj`) alongside AppHost and ServiceDefaults, then reference it from `Program.cs`:

```csharp
var api = builder.AddProject<Projects.ApiService>("api")
    .WaitFor(relay);
```

The Bun/Node source code in the sibling folders is unchanged by this orchestration layer.
