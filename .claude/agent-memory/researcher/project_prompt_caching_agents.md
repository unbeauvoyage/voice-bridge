---
name: Anthropic Prompt Caching — Multi-Agent Behavior
description: TTL behavior, sub-agent cache isolation, and optimal shutdown windows for long-running agent sessions
type: project
---

Researched 2026-04-08. Full findings at `/Users/riseof/environment/questions/2026-04-08-anthropic-prompt-caching-ttl.md`.

Key facts:
- 5-min TTL (default, 1.25x write cost) and 1-hour TTL (2x write cost) both available
- Cache reads (hits) cost 0.1x base regardless of TTL
- TTL resets on each hit — active agents keep cache warm indefinitely
- Sub-agents have isolated context windows but share the system prompt cache if prefix is identical
- Cache isolation is workspace-level (as of Feb 5, 2026), not organization-level
- Minimum cacheable size: 1024 tokens (most models), 2048 for Haiku
- Optimal shutdown: once idle > TTL, cache benefit = zero; re-spawn costs same as re-write

**Why:** CEO asked whether keeping agents alive has a cost benefit from prompt caching — answer is yes while idle < TTL, zero benefit after.

**How to apply:** When asked about agent lifecycle costs or whether to keep/spawn agents, use these TTL breakpoints as the cost-neutral thresholds.
