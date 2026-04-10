# How We Fixed hq (and Channel Delivery Generally)

## The Problem
hq was not receiving channel messages despite the plugin returning `{"status":"delivered"}`.

## Root Causes Found (in order of discovery)

### 1. The `void` bug — plugin lying about delivery
**File:** `channel-plugin/index.ts` (both source and cache)

```typescript
// BEFORE (broken):
void mcp.notification({...})          // fire-and-forget, errors swallowed
return Response.json({ status: 'delivered' })  // always lies

// AFTER (fixed):
try {
  await mcp.notification({...})       // actually waits for result
  return Response.json({ status: 'delivered' })  // only true if it worked
} catch (notifErr) {
  setTimeout(() => process.exit(1), 100)  // self-terminate zombie
  return Response.json({ error: 'MCP transport broken' }, { status: 500 })
}
```

### 2. Fix must go in the CACHED plugin, not just the source
Claude Code runs the plugin from:
`~/.claude/plugins/cache/hub-plugins/hub-channel/1.0.0/index.ts`

NOT from `~/environment/message-hub/channel-plugin/index.ts`.

Editing the source file has no effect until the plugin cache is updated.
**Always edit both files, or set up a sync.**

### 3. ⚠️ ZOMBIE PLUGIN — The Hardest Silent Failure
**This is the most dangerous failure mode in the entire system.**

When a Claude session ends (workspace closed, crash, restart), the plugin process **does not die**. It keeps running. It holds its port. It answers `/health` correctly with `{"agent":"hq","status":"ok"}`. The relay thinks it's alive. The relay happily routes messages to it.

But its MCP transport (the stdio pipe to Claude) is dead. The Claude session it was connected to is gone.

So: message arrives → plugin accepts it → plugin tries to push to Claude → nothing → (before the `void` fix) returns 200 anyway → relay marks delivered → **message is gone forever, no error, no warning.**

The reason this is so hard to catch:
- The relay's health check hits `/health` — passes ✓
- The relay's delivery attempt hits `/deliver` — returns 200 ✓  
- The plugin logs "Notification sent successfully" — looks fine ✓
- The message simply never appears in any Claude session

**After the `void` fix:** the zombie returns 500 and self-terminates. But until sessions are restarted with the fixed plugin, zombies are still lying.

**How to detect zombies:** `lsof -i TCP -sTCP:LISTEN | grep bun` — any bun process started hours ago is likely a zombie.
**How to kill:** `kill <zombie-pid>`
**Long-term fix:** the `void→await` fix makes zombies self-destruct on first failed delivery.

### 4. Fire-and-forget registration (no retry)
`registerWithHub()` runs once at startup. If the relay is momentarily down, the plugin never re-registers and is unreachable.

**Workaround:** manually register: `curl -X POST http://localhost:8765/register-channel -d '{"agent":"hq","port":PORT}'`

**Proper fix:** add a retry loop to `registerWithHub()` (not yet done).

## Steps Taken to Fix hq
1. Edited `void` → `await` in both source AND cache files
2. Restarted all agents so they picked up the fixed plugin
3. Discovered zombie bun process (PID 19686) still holding port 50971 → killed it
4. New hq plugin (PID 29518) started on port 54805 but registration failed silently
5. Manually registered: `curl -X POST .../register-channel {"agent":"hq","port":54805}`
6. Tested: message arrived, hq responded "Loud and clear."

## What's Still Not Fixed
- `registerWithHub()` has no retry — single failure = agent is deaf
- Multiple zombie bun processes accumulate over time (PID 13827 from 4:48PM still running)
- Source file and cache file are out of sync — need a sync mechanism or symlink
