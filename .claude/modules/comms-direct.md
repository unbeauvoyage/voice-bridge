# Communication Mode: Direct (No Relay)

**Status: Not yet implemented — placeholder for future use.**

In this mode, agents communicate directly via Claude Code Channels without a central relay server.

Key differences from relay mode:
- No central message router — agents must know each other's channel ports
- No message queuing for offline agents — messages are lost if target is down
- No voice transcription endpoint — must use whisper-cli directly
- No central /channels registry — discovery is peer-to-peer
- No delivery failure alerts — each agent must handle its own error reporting

TODO: Define discovery mechanism, delivery guarantees, and fallback behavior.
