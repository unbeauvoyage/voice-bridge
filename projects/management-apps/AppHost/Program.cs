var builder = DistributedApplication.CreateBuilder(args);

// message-relay — lean relay (Bun), listens on LEAN_RELAY_PORT
var relay = builder.AddExecutable(
        "relay",
        "bun",
        workingDirectory: "../message-relay",
        "run", "src/relay-lean.ts")
    .WithEnvironment("LEAN_RELAY_PORT", "8767")
    .WithHttpEndpoint(port: 8767, name: "http")
    .WithExternalHttpEndpoints();

// voice-bridge2 server (Bun), listens on PORT
var voiceBridge = builder.AddExecutable(
        "voice-bridge",
        "bun",
        workingDirectory: "../voice-bridge2",
        "run", "server/index.ts")
    .WithEnvironment("PORT", "3030")
    .WithHttpEndpoint(port: 3030, name: "http")
    .WithExternalHttpEndpoints()
    .WaitFor(relay);

// wake-word daemon (Python) — depends on voice-bridge being healthy
builder.AddExecutable(
        "wake-word",
        "python3",
        workingDirectory: "../voice-bridge2/daemon",
        "wake_word.py", "--server", "http://127.0.0.1:3030", "--target", "command")
    .WaitFor(voiceBridge);

// ceo-app dev server (React Router / Vite via Bun)
builder.AddExecutable(
        "ceo-app",
        "bun",
        workingDirectory: "../ceo-app",
        "run", "dev")
    .WithHttpEndpoint(port: 5173, name: "http")
    .WithExternalHttpEndpoints()
    .WaitFor(relay);

builder.Build().Run();
