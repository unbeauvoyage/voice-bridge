var builder = DistributedApplication.CreateBuilder(args);

// message-relay — lean relay (Bun). DCP allocates an internal port, injects it
// via LEAN_RELAY_PORT, and proxies external 8767 → that internal port.
var relay = builder.AddExecutable(
        "relay",
        "bun",
        workingDirectory: "../message-relay",
        "run", "src/relay-lean.ts")
    .WithHttpEndpoint(port: 8767, name: "http", env: "LEAN_RELAY_PORT")
    .WithExternalHttpEndpoints();

// voice-bridge2 server (Bun). Reads PORT from env, so env-injection works.
var voiceBridgeServer = builder.AddExecutable(
        "voice-bridge-server",
        "bun",
        workingDirectory: "../voice-bridge2",
        "run", "server/index.ts")
    .WithHttpEndpoint(port: 3030, name: "http", env: "PORT")
    .WithExternalHttpEndpoints()
    .WaitFor(relay);

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

// ceo-app dev server (React Router / Vite via Bun). Vite respects --port flag
// but not PORT env, so we pass --port 5175 as args. isProxied: false prevents
// DCP from allocating a second port — the process binds 5175 directly.
builder.AddExecutable(
        "ceo-app",
        "bun",
        workingDirectory: "../ceo-app",
        "run", "dev", "--", "--port", "5175")
    .WithHttpEndpoint(port: 5175, name: "http", isProxied: false)
    .WithExternalHttpEndpoints()
    .WaitFor(relay);

builder.Build().Run();
