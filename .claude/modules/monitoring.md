# Permission Monitoring System (3 Tiers)

Keeps agents unblocked without burning manager tokens. Managers must understand all tiers.

## Tier 1 — Bash polling (5s, zero tokens)
`bash ~/environment/scripts/start-monitor.sh &`
- Scans all workspace panes every 5 seconds via `cmux capture-pane`
- Greps for Claude Code permission dialog patterns (both Format A tool approvals and Format B project permissions)
- Auto-approves known-safe tools/commands with option 2; POSTs alert to consul for unknowns
- **Coverage:** Standard tool approvals, bash command prompts
- **Battery:** Negligible (~1% CPU)

Start on system boot or after cmux restart. Check if running: `pgrep -fa monitor-agents`

## Tier 2 — Local LLM review (5–10 min, low tokens)
*Planned — not yet implemented*
- Runs same pane capture, feeds ambiguous prompts to LM Studio (MLX model) for smarter approve/deny
- Catches edge cases the grep-based Tier 1 misses
- Owned by relay-server project — see message-relay/.worklog/ for implementation status

## Tier 3 — Event-driven hooks (instant, zero tokens, most reliable)
*Target architecture — relay-server project owns implementation*
- Claude Code `PostToolUse` / pre-permission hooks fire before any permission prompt
- Hook POSTs to relay → relay pushes to consul channel instantly → consul approves/denies
- Zero polling, zero lag, works even when agent is mid-task
- Endpoint: `POST http://localhost:8767/hook/permission/approve` or `/deny`

**Priority:** Tier 3 is the end goal. Tier 1 is the safety net while Tier 3 is built out.
**Ownership:** relay-server project owns Tiers 2 and 3 implementation. Meta-managers own Tier 1 deployment.
**No Codex on this work** — this is a Claude Code system; Claude agents implement it.
