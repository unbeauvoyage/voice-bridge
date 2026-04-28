# ContentService (.NET)

**Sibling of `content-service/` (TypeScript). TS is canonical; this service strives for feature parity, never invents its own contract.**

The TS service defines the wire contract via `content-service/docs/openapi.yaml`. This .NET service serves the **same byte-for-byte OpenAPI document** at `GET /openapi.yaml` (linked from the TS file via project property — see "Storage convention" below). Spec mismatches mean TS is right and this service is wrong.

## Port

`http://localhost:8771` (TS sibling is :8770; .NET is +1). AppHost emits both URLs as env vars to ceo-app (`CONTENT_SERVICE_URL_TS`, `CONTENT_SERVICE_URL_DOTNET`); ceo-app's settings toggle picks one. The toggle MUST be invisible to the user — same wire shape both sides.

## Wire contract (canonical — read `content-service/docs/openapi.yaml` for the full spec)

All routes accept and return `application/json` unless noted.

- **`POST /upload`** — multipart/form-data with a single `file` field.
  - Computes SHA-256 of the bytes, stores at `<CONTENT_DIR>/<sha256>.<ext>`.
  - **200**: `{ id, url, mime, bytes, sha256 }` where `id == sha256` (yes, both fields, same value — the OpenAPI spells this out as a `const`-style equality).
  - **400** `{ error: "no_file" }` — multipart had no `file` part.
  - **400** `{ error: "empty_file" }` — `file` part had zero bytes.
  - **413** `{ error: "too_large", maxBytes: 26214400 }` — payload > 25 MiB.
  - **415** `{ error: "unsupported_media_type", message, allowed }` — MIME not in the allowlist.

- **`GET /files/{idWithExt}`** — fetch stored bytes.
  - Path param **must** match `^[0-9a-f]{64}\.(png|jpg|webp|gif)$`. Anything else → 404 (path-traversal-safe by validation; we never touch disk for invalid input).
  - **200**: bytes, `Content-Type: <mime from extension>`, `Cache-Control: public, max-age=31536000, immutable`.
  - **404** `{ error: "not_found" }` — id valid but no file on disk.

- **`GET /health`** — `{ status: "ok", service: "content-service" }`.
  - The default Aspire `MapDefaultEndpoints()` shape does **NOT** match. We override with a `Features/Health` slice so the toggle stays invisible.

- **`GET /version`** — `{ name: "content-service", version: "0.1.0" }`.
  - **NOT** the .NET assembly version; OpenAPI declares `name` and `version` as content-service-specific constants. Honor the constants.

- **`GET /openapi.yaml`** — serves the byte-identical TS OpenAPI document.
  - `Content-Type: application/yaml; charset=utf-8`.

## Allowlist (matches TS `storage.ts` exactly)

| MIME | extension |
|---|---|
| `image/png` | `.png` |
| `image/jpeg` | `.jpg` |
| `image/webp` | `.webp` |
| `image/gif` | `.gif` |

`MAX_BYTES = 25 * 1024 * 1024` (25 MiB).

## Storage convention

Filesystem at `<CONTENT_DIR>/<sha256>.<ext>` (extension MATTERS — TS sibling reads/writes this layout). Default `CONTENT_DIR` = `~/.claude/content/`. Tests MUST override to a per-test temp dir; never touch the user's `~/.claude/content/`.

The two services are interchangeable readers/writers of the **same** store. A file written by TS must be readable byte-identical by .NET, and vice versa. The flagship cross-stack story test proves this invariant.

### Atomic write — .NET goes beyond TS

TS's `storeFile` does plain `writeFile` after `existsSync` (partial-file vulnerability on crash). The .NET implementation MUST use temp-write + rename:

1. Write bytes to `<CONTENT_DIR>/.<sha256>.<ext>.tmp.<random>` via `FileStream(useAsync: true)`.
2. Verify hash matches the streamed-and-tee'd SHA-256 computation.
3. `File.Move(temp, final, overwrite: false)` — Move is atomic on the same volume on POSIX.
4. On exception or hash mismatch, delete the temp file and surface 5xx.

Justification: partial files in the **shared** store would corrupt both stacks. The .NET side going defensively atomic costs nothing and protects TS readers too. Approved by chief-of-staff (parity in spirit, not bug-for-bug).

### Path-traversal safety

The path-param validation regex `^[0-9a-f]{64}\.(png|jpg|webp|gif)$` is the safety boundary. ContentService does **not** trust user input past that regex. Concretely:

- `[GeneratedRegex]` source-gen the pattern at compile time.
- Reject before any `Path.Combine` call. The combined path is then guaranteed safe.
- No relative-path resolution, no symlink-following beyond what `FileStream` does natively.

### `[GeneratedRegex]`-only

`SYSLIB1045` is set to error. Every regex used on hot paths (the path-param validator + the optional MIME matcher) is source-generated.

## Architecture — vertical slice

**Routes do not live in `Program.cs`.** Each feature owns its folder under `Features/`:

```
ContentService/
├── Program.cs                          (composition root only — ~10 lines)
├── Features/
│   ├── Upload/
│   │   ├── UploadEndpoint.cs           (static class; MapUploadFeature extension)
│   │   ├── UploadResponse.cs           (record; matches OpenAPI UploadResult)
│   │   └── UploadHandler.cs
│   ├── GetFile/
│   │   ├── GetFileEndpoint.cs
│   │   └── GetFileHandler.cs
│   ├── Health/HealthEndpoint.cs
│   ├── Version/VersionEndpoint.cs
│   └── OpenApi/OpenApiEndpoint.cs
└── tests/                              (companion ContentService.Tests/ csproj)
```

Each `<Feature>Endpoint.cs` exposes one extension method on `IEndpointRouteBuilder`:

```csharp
public static IEndpointRouteBuilder MapUploadFeature(this IEndpointRouteBuilder app)
{
    app.MapPost("/upload", UploadHandler.HandleAsync).DisableAntiforgery();
    return app;
}
```

`Program.cs` wires features one line each. If you find yourself adding `app.MapPost(...)` directly in `Program.cs`, **move it into a feature folder before you commit**.

## Strict rules (compile-level)

Inherited from `BackendShared/Backends.props` + repo-root `.editorconfig` + `BackendShared/BannedSymbols.txt`. Highlights enforced at compile time:

- `dynamic` keyword — banned (`Backends.targets` grep target).
- `var` (loose) — banned (`csharp_style_var_*_= false:error`).
- `as` casts (dangerous form) — banned (`RCS1206 = error` via Roslynator).
- Null-forgiving `!` — review-banned today; tracked as Task #25 for a real analyzer.
- `Console.WriteLine`, `DateTime.Now`, `Thread.Sleep`, sync `File.*` IO, `MD5`, `SHA1`, `string.GetHashCode` for content addressing — all banned via `BannedSymbols.txt` (RS0030 = error).
- Time → `TimeProvider.System` only.
- Logging → `ILogger<T>` source-generated (`CA1848 = error`).
- Hashing → `SHA256.HashData` / `SHA256.HashDataAsync` only (`CA1850 = error`).
- File IO → `FileStream` with `useAsync: true` only.
- HTTP clients → `IHttpClientFactory.CreateClient(name)` only; direct `new HttpClient(...)` banned.
- String comparison → explicit `StringComparison.Ordinal` required.
- `[GeneratedRegex]` source-gen mandatory (`SYSLIB1045 = error`).
- `InvariantGlobalization=true` — backend services run with no ICU/NLS data.

If a rule annoys you, change `Backends.props` / `.editorconfig` / `BannedSymbols.txt` instead of suppressing it locally. Per-file/per-line suppressions are a defect.

## Testing — real AppHost, real disk

User-story tests only at `ContentService.Tests/stories/<feature>/<scenario>.story.cs`.

- **Framework**: xunit.v3 + `Aspire.Hosting.Testing`'s `DistributedApplicationTestingBuilder.CreateAsync<Projects.ManagementApps_AppHost>()`.
- **Real**: AppHost in-process; real ContentService binary; real HttpClient.
- **Disk**: per-test temp dir injected via `CONTENT_DIR` env var override. Never the user's `~/.claude/content/`.
- **No mocks** of the SUT. SHA-256 computation, file IO, multipart parsing — all run for real.
- **Negative-control proven** for every assertion: prove the assertion CAN fail (assert wrong literal first, confirm RED, revert).

The flagship test is **cross-stack**: upload via TS service, fetch via .NET service (and vice versa). Both services share the same temp `CONTENT_DIR`. Story name: `image uploaded via TS service is fetchable byte-identical via .NET service`.

## Restart after edits

`dotnet watch run` from `ContentService/` hot-reloads on file changes. AppHost-managed: AppHost relaunch (`cd AppHost && dotnet run`) picks up code changes after the next DCP cycle. Never tell the CEO to restart — agents are responsible for restarts.
