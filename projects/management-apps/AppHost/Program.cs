var builder = DistributedApplication.CreateBuilder(args);

// FIRST-BOOT MODE: only message-relay is wired so we can verify the Aspire
// dashboard + service lifecycle without colliding with the wake-word session
// or stomping ceo-app's dev server. Uncomment the other services as we
// confirm each one boots cleanly in the dashboard.

// message-relay — lean relay (Bun). Aspire allocates the internal port and
// injects it into LEAN_RELAY_PORT; DCP proxies external 8767 → that port.
var relay = builder.AddExecutable(
        "relay",
        "bun",
        workingDirectory: "../message-relay",
        "run", "src/relay-lean.ts")
    .WithHttpEndpoint(port: 8767, name: "http", env: "LEAN_RELAY_PORT")
    .WithExternalHttpEndpoints();

// voice-bridge2 server (Bun) — uncomment when ready to swap from your
// running instance. Listens on PORT (3030).
//
// var voiceBridge = builder.AddExecutable(
//         "voice-bridge",
//         "bun",
//         workingDirectory: "../voice-bridge2",
//         "run", "server/index.ts")
//     .WithEnvironment("PORT", "3030")
//     .WithHttpEndpoint(port: 3030, name: "http")
//     .WithExternalHttpEndpoints()
//     .WaitFor(relay);

// wake-word daemon (Python) — uncomment after voice-bridge2 wiring.
//
// builder.AddExecutable(
//         "wake-word",
//         "python3",
//         workingDirectory: "../voice-bridge2/daemon",
//         "wake_word.py", "--server", "http://127.0.0.1:3030", "--target", "command")
//     .WaitFor(voiceBridge);

// ceo-app dev server (React Router / Vite via Bun) — uncomment when ready
// to manage it through Aspire.
//
// builder.AddExecutable(
//         "ceo-app",
//         "bun",
//         workingDirectory: "../ceo-app",
//         "run", "dev")
//     .WithHttpEndpoint(port: 5173, name: "http")
//     .WithExternalHttpEndpoints()
//     .WaitFor(relay);

// Suppress unused-variable warning for `relay` until other services WaitFor it.
_ = relay;

builder.Build().Run();
