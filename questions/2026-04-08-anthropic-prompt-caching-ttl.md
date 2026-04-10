---
type: question
title: Anthropic Prompt Caching TTL — Multi-Agent and Sub-Agent Behavior
summary: The 5-min and 1-hour TTLs apply to any API call including sub-agents, but each agent gets its own isolated context. The cache only refreshes on access — idle agents past the TTL pay a re-write cost. Optimal shutdown window is after 1 hour if using extended TTL.
status: answered
asked: 2026-04-08T00:00:00
asked-by: ceo
triggered-by: manual
tags: [prompt-caching, agents, cost, TTL, sub-agents, TeamCreate]
---

# Anthropic Prompt Caching TTL — Multi-Agent and Sub-Agent Behavior

**Research date:** 2026-04-08
**Sources:** Anthropic prompt caching docs, Claude Agent SDK overview, community analysis (2025–2026)

---

## Q1: Does Anthropic's prompt cache apply to TeamCreate or Agent tool sub-agents?

**Yes, but with per-agent isolation.**

Every call to the Anthropic API — whether from a parent agent, a TeamCreate teammate, or an Agent tool invocation — is a separate API call. The prompt cache applies to each call independently.

Key facts from the official docs:
- Cache entries are matched by **exact prefix**. If two agents (e.g., a parent and a spawned reviewer) send identical system prompts, they will hit the same cache entry and share its benefit.
- Sub-agents spawned via the Agent SDK have their **own isolated context window**, separate from the parent. They do not inherit the parent's conversation history.
- However, the **system prompt is shared with the parent for cache efficiency** — meaning if the parent already wrote a cache entry for that system prompt, the sub-agent will read from it at 0.1x cost rather than paying for a new write. (Source: community research on Claude Agent SDK subagent behavior.)
- Cache entries only become available after the **first response begins**. For parallel sub-agents, the first one pays the write cost; subsequent ones that start after the first completes can read from cache.

**Practical implication:** TeamCreate agents (which run as persistent sessions) and Agent tool agents (one-shot) both benefit from prompt caching. The key is that the system prompt must be byte-for-byte identical to trigger a cache hit. This works well for the standard agent system prompt injected by Claude Code/Agent SDK.

---

## Q2: Does cache re-charge cost money after an idle agent's cache expires?

**Yes — cache expiry means re-paying the write cost.**

TTL behavior (from official Anthropic docs):
- **5-minute cache (default):** Expires after 5 minutes of *inactivity*. Each cache hit within the TTL resets the timer at no additional cost (read = 0.1x, refresh = free).
- **1-hour cache:** Expires after 1 hour of inactivity. Cache hits refresh the TTL at no additional write cost.

After expiry, the next request with the same prefix triggers a **new cache write**:
- 5-min write: 1.25x base input token price
- 1-hour write: 2x base input token price
- Cache read (hit): 0.1x base input token price

So an agent that was idle for 6 minutes on a 5-min cache will pay the full write price on its next message — same as spawning fresh. An agent idle for 1+ hours on a 1-hour cache will also re-pay the write cost.

**There is no penalty for the re-write itself beyond the write cost.** The cache is just cold — you pay normal write cost, not an extra penalty.

---

## Q3: What is the optimal shutdown window — when does keeping an agent alive stop being a cache benefit?

**The break-even point equals the cache TTL.**

| Cache type | Keep alive if idle < | Shut down if idle > |
|---|---|---|
| 5-min (default) | 5 minutes | 5 minutes |
| 1-hour (extended) | 1 hour | 1 hour |

Once the TTL expires, keeping the agent alive provides zero caching benefit — the next API call pays the full write cost either way. At that point, shutting down and re-spawning costs the same as letting it idle.

**Cost comparison for deciding which TTL to use:**
- If agents are called **frequently** (every few minutes): 5-min cache at 1.25x write is cheaper overall.
- If agents have **longer idle gaps** (5 min–1 hour): 1-hour cache at 2x write avoids repeated re-writes.
- If agents are **idle >1 hour consistently**: neither cache helps; a re-spawn costs the same as a re-write.

For a typical multi-agent coding session where coders and reviewers may sit idle while waiting for other agents:
- **Coder agents** doing active work: 5-min cache is fine (they're called frequently during a sprint).
- **Reviewers waiting on code completion**: If the wait exceeds 5 minutes, use 1-hour cache or accept the re-write cost.
- **Tester agents** running end-to-end suites: Likely idle >1 hour between runs; no cache benefit. Spawn fresh each time.

**Additional factor — context size matters:** The bigger the system prompt and conversation history, the more valuable the cache is. A small agent with a 1,000-token system prompt gains little from caching (Haiku requires 2,048 tokens minimum to cache; most models require 1,024 tokens minimum). A coder agent with a 20,000-token accumulated conversation window has major cache value.

---

## Q4: Are there documented differences in cache TTL for long-running sessions vs sub-agents?

**No documented difference — TTL behavior is uniform at the API level.**

The Anthropic docs do not distinguish between long-running interactive sessions and short-lived sub-agents for TTL purposes. Both are subject to the same 5-minute or 1-hour TTL depending on which `cache_control` setting is used (or automatic caching behavior).

**Automatic caching (no explicit `cache_control`):** Claude automatically caches large prefixes without explicit markers on supported models. This uses a 5-minute TTL by default.

**Explicit 1-hour caching:** Requires adding `"cache_control": {"type": "ephemeral", "ttl": "1h"}` at the desired breakpoint. The 1-hour TTL costs 2x base input write price but is not restricted to any particular session type.

**Workspace isolation (as of February 5, 2026):** Prompt caches are now isolated at the workspace level (not organization level). Two agents in the same workspace can share a cache entry if they send identical prefixes. Two agents in different workspaces cannot share cache entries.

**Claude Code / Agent SDK behavior:** The SDK manages prompt caching automatically. There is no explicit API surface in the SDK to control TTL — the SDK uses Anthropic's defaults (auto-caching) unless the underlying API calls are customized.

---

## Summary Recommendation for This System

| Agent role | Activity pattern | Recommended strategy |
|---|---|---|
| Coder (active sprint) | Frequent calls every 1–5 min | Keep alive — 5-min cache stays warm |
| Reviewer (waiting on code) | Idle 5–30 min between tasks | Keep alive with 1-hour cache (`ttl: "1h"`) |
| Tester (scheduled runs) | Idle hours between runs | Spawn fresh — no cache benefit after 1 hour |
| TeamCreate persistent session | Depends on workload cadence | Use 1-hour cache as default safety; evaluate per-role |

The "keep agents alive forever" policy (current system rule) does not increase caching costs — idle agents don't consume tokens. The cost only occurs at the **next API call** after TTL expiry, when the cache must be rebuilt. Keeping an idle agent alive has zero recurring cost from caching; the cost is only the session infrastructure overhead (cmux pane, etc.), not the API.

---

## Sources

- [Anthropic Prompt Caching — Official Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude Agent SDK Overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Amazon Bedrock — 1-hour prompt caching (Jan 2026)](https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-bedrock-one-hour-duration-prompt-caching/)
- [Anthropic Prompt Caching 2026 Guide — AI Checker Hub](https://aicheckerhub.com/anthropic-prompt-caching-2026-cost-latency-guide)
- [How Prompt Caching Elevates Claude Code Agents — Walturn](https://www.walturn.com/insights/how-prompt-caching-elevates-claude-code-agents)
- [Best Practices for Claude Code Sub-agents — PubNub](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)
- [Anthropic Just Fixed the Biggest Hidden Cost in AI Agents — Medium](https://medium.com/ai-software-engineer/anthropic-just-fixed-the-biggest-hidden-cost-in-ai-agents-using-automatic-prompt-caching-9d47c95903c5)
