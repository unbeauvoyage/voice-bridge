# Inter-Agent Messaging: Method Comparison

## Problems vs Methods

| Problem | Old: cmux send (pty injection) | New: cmux notify (notification system) |
|---------|-------------------------------|---------------------------------------|
| **Agent message looks like CEO typed it** | Broken — COMMAND can't distinguish agent from CEO. `[MSG]` prefix is a hack. | **Solved** — notifications are a separate channel. Terminal input is untouched. COMMAND reads them via `cmux list-notifications`. |
| **CEO is mid-typing, agent injects** | Broken — text interleaves. CEO's partial input gets garbled with agent's message. | **Solved** — notifications don't touch the terminal buffer at all. CEO keeps typing undisturbed. |
| **COMMAND is busy (generating response)** | Fails — "Failed to write to socket". Needs retry/queue. | **Solved** — notifications queue up in cmux's own system. They sit there until read. |
| **Two agents send simultaneously** | Broken — characters interleave in the terminal. | **Solved** — each notification is atomic. Two agents notify at the same time, two separate entries in the notification list. |
| **Mac sleeps, workspaces change** | Broken — hardcoded surface refs become invalid. Need dynamic lookup. | **Partially solved** — still need the right workspace ref, but notifications persist across sleep. |
| **Message ordering** | Fragile — depends on timing of pty injection. | **Solved** — notifications are timestamped and ordered in the list. |
| **Message persistence / no lost messages** | Lost if terminal buffer overflows or session restarts. | **Solved** — notifications persist in cmux until explicitly cleared. Have read/unread state. |
| **Token cost (polling)** | File-based inbox needed CronCreate polling (tokens every 30s). | **Low cost** — COMMAND checks `cmux list-notifications` between tasks. One Bash call, no Claude tokens unless there are messages. |

## Remaining Gaps

| Remaining issue | Status |
|----------------|--------|
| **Agents without Bash can't call cmux notify** | Need the message hub server as proxy — agent POSTs to HTTP server, server calls cmux notify |
| **COMMAND needs to actively check notifications** | Need a lightweight CronCreate (every 30-60s) to run `cmux list-notifications` and process unread ones. Small token cost but unavoidable. |
| **Notification content is limited** | Title + subtitle + body — fine for short messages, not for large data. Large data still goes in worklogs. |

## Open Questions (to be resolved before building)

1. **What exactly are cmux notifications?** — Are they UI-only (badge/popup) or do they have a proper message queue behind them? Do they survive cmux restarts?
2. **How do agents know about incoming notifications?** — Is there a push mechanism, or must agents poll `cmux list-notifications`?
3. **Token usage** — Does checking notifications consume Claude tokens? (Running `cmux list-notifications` via Bash tool costs one tool call worth of tokens per check.)
4. **Guaranteed delivery** — What happens if cmux crashes between notify and list? Are notifications persisted to disk or in-memory only?
5. **Notification capacity** — Is there a limit on how many notifications can queue up? What happens when the limit is reached?
