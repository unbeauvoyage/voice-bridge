---
title: "Haiku vs Sonnet Coder Lifecycle — Relay-Side Evidence Pass"
date: 2026-04-16T02:30:11
status: proposed
priority: high
author: message-relay
summary: Read-only analysis of message-relay logs and queues to test the hypothesis that haiku coder lifecycle failures (idle_notification vs shutdown_approved, unread TaskList, no response to SendMessage) are caused by something the relay sees. Conclusion — the relay sees nothing. Zero haiku coder traffic in any relay data store. This absence is itself the finding: lifecycle failure happens entirely upstream of the relay, in the Claude Code session bootstrap phase. The controlled comparison must move to ~/.claude/projects/**/*.jsonl — the relay cannot provide the evidence.
---

## Scope of This Pass

Chief-of-staff, at CEO direction, greenlit a read-only research pass over `message-relay/logs/relay.jsonl`, `message-relay/queues/*.jsonl`, and `message-relay/logs/quarantine.jsonl` to test whether the 10-coder haiku failure (documented in WORKFLOW-REVIEW.md, proposal `2026-04-15-persistent-haiku-team-failure.md`) leaves any signature in relay-side data.

The assigned deliverables were:
1. Cohort selection + timestamps
2. Three metrics: time-to-first-response, response rate, shutdown vs idle ratio
3. Evidence excerpts (actual log lines)
4. Working hypothesis for root cause
5. Recommended next experiment

No code was written. No commits made. Pure read analysis using Read, Grep, and jq.

---

## The Headline Finding (State Upfront)

**The relay has no data on haiku coder lifecycle because haiku coders never produce relay traffic when they fail.** Every relay data store (operational log, per-agent persistence queue, quarantine log) shows zero entries attributable to a haiku coder cohort. The failure is pre-relay.

This matches — and strengthens — the upstream observation that quarantine entries for real agents are zero. It is not "haiku coders try to send but are blocked." It is "haiku coders never attempt to send." Which means the failure point is in the Claude Code session's own bootstrap (TaskList read, team mailbox delivery, first-turn prompt assembly, tool availability) **before** any MCP/relay interaction is possible.

The controlled Sonnet-vs-Haiku comparison the chief-of-staff wants cannot be run from relay data. It has to be run against `~/.claude/projects/**/*.jsonl` — the session transcript files written by Claude Code itself.

---

## Evidence

### Log store 1 — `message-relay/logs/relay.jsonl` (284 lines)

Operational log only. Contains relay-lifecycle events: startup banners, auth blocks, permission restores, malformed JSONL skips. Does **not** contain one line per HTTP request — the `log.http()` method is defined in `src/logger.ts` but is never called from `src/relay-lean.ts`. Verified:

```
$ grep -n 'log\.http(' src/
src/logger.ts:17: *   log.http(method, url, ip)
src/__tests__/logger-and-logs-endpoint.test.ts:121:    log.http('GET', '/status', '127.0.0.1');
```

Only the documentation comment and the logger's own unit test. Zero production call sites. Per-request traffic is therefore invisible to this file.

Context breakdown of all 284 lines:

```
261 relay-lean    (startup, auth warnings, permission restores, security blocks)
 21 relay-auth    (rejected unauthenticated requests — hardening tests)
  1 attachments   (attachment subsystem)
```

No ctx="http", no ctx="send", no ctx="delivery" — because none are ever emitted. The structural bug: the relay has an HTTP logger it never uses.

### Log store 2 — `message-relay/logs/quarantine.jsonl` (3 lines)

```
{"ts":"2026-04-15T15:42:15.507Z","from":"fake-attacker","to":"ceo","type":"message","ip":"127.0.0.1","reason":"sender not registered — no port file"}
{"ts":"2026-04-15T15:42:30.531Z","from":"fake-attacker","to":"ceo","type":"message","ip":"127.0.0.1","reason":"sender not registered — no port file"}
{"ts":"2026-04-15T15:42:49.355Z","from":"fake-attacker","to":"ceo","type":"message","ip":"127.0.0.1","reason":"sender not registered — no port file"}
```

All three are the relay-hardening test fixture asserting the sender allowlist returns 403 for unregistered senders. Zero entries from any real agent. Zero from any `coder-*` name. If a haiku coder had ever tried to `/send` without first establishing a port file, it would appear here — none did.

### Log store 3 — `message-relay/queues/*.jsonl` (per-agent persistence)

```
ceo.jsonl               1669 bytes   4 messages
chief-of-staff.jsonl    1171 bytes   1 message
no-such-agent-xyz.jsonl  495 bytes   (test fixture)
test-hardening-sender.jsonl 498 bytes (test fixture)
```

The only non-test queues are `ceo` and `chief-of-staff`. The `ceo` queue contains 3 test-hardening probes plus 1 real chief-of-staff → ceo message from 2026-04-15T15:48:19Z (the first relay-identity-auth proposal hand-off). The `chief-of-staff` queue contains exactly 1 message — its own echo of that same hand-off.

**There is no per-agent queue file for any coder.** Not haiku, not sonnet, not opus. The relay has no persistent record of coder-to-anyone traffic at all in the analysis window. Note that with the Phase 2 JSONL architecture, per-message queue writes are being deprecated in favor of reading Claude Code's own session files — but the deprecation does not yet explain the empty queues, because the remaining code path still writes `ceo.jsonl` and `chief-of-staff.jsonl` when relay is the persistence layer. If coders had produced messages, those messages would have been appended. They weren't.

### Auth-reject population — who ever tries to send without a port file?

```
5× test-sender → offline-*     (hardening test)
4× test-agent → ceo            (hardening test)
4× heartbeat → voice-bridge    (system-scheduler heartbeat probe)
4× heartbeat → test-probe      (system-scheduler heartbeat probe)
4× heartbeat → message-relay   (system-scheduler heartbeat probe)
4× heartbeat → manual-test     (system-scheduler heartbeat probe)
4× heartbeat → chief-of-staff  (system-scheduler heartbeat probe)
3× fake-attacker → ceo         (hardening test)
2× api-type-tester → ceo       (hardening test)
1× test → test                 (hardening test)
```

Every rejected sender is either a test fixture or the system-scheduler heartbeat (which intentionally sends without a port file). There is no rejected `coder-*`, no rejected haiku agent name pattern, nothing resembling the 10-coder cohort from proposal `2026-04-15-persistent-haiku-team-failure.md`.

### Currently-live port files (at time of analysis)

```
chief-of-staff.port
command.port
knowledge-base.port
message-relay.port
productivitesse.port
test-probe.port
voice-bridge.port
```

Seven agents. None are coders. This is the current system state — no coder cohort is running — but the absence is consistent throughout the log window: coder port files come and go with their sessions and leave no persistent trace when they fail before establishing one.

---

## The Three Metrics — Cannot Be Computed From Relay Data

| Metric | Source needed | Relay has it? |
|---|---|---|
| Time-to-first-response after SendMessage | Inbound message timestamp + first outbound reply timestamp per agent | **No** — relay neither timestamps inbound per-agent nor logs outbound replies at the HTTP layer |
| Response rate (replies / inbound) | Per-agent inbound count + per-agent outbound count | **No** — same reason |
| shutdown_approved vs idle_notification ratio | Team teardown protocol messages between team lead and team members | **No** — these messages travel via TeamCreate/SendMessage (in-process mailbox), not via the HTTP relay at all |

The third row is the most damning. The `shutdown_approved` / `idle_notification` protocol lives inside the team-tool subsystem, not the HTTP relay. Even if relay logging were perfect, it would not see this protocol. The chief-of-staff's open question about that ratio **requires instrumenting the team mailbox, not the relay.**

---

## Working Hypothesis (Root Cause)

The hypothesis this evidence supports:

> Haiku coder lifecycle failures occur during Claude Code session bootstrap, after the team has been created and before the agent's first tool call. The agent is spawned, its system prompt is loaded, but it never (a) issues a `TaskGet` to read assigned work, (b) produces a message via the team mailbox, or (c) triggers any MCP-mediated side effect that would create a port file or touch the relay. From the outside it appears as "assigned → silent → idle_notification on teardown." From the relay's perspective it doesn't exist.

Candidate sub-causes, from most to least likely given the absence of relay traffic:

1. **TaskList is not auto-read** — haiku may be waiting for an explicit first-turn user prompt and not polling TaskList on its own. Team infrastructure assumes self-polling; haiku may not do it. Consistent with WORKFLOW-REVIEW.md "What Works" #1: "when team lead pushed tasks directly via SendMessage rather than expecting agents to poll TaskList themselves, work moved."

2. **Team mailbox delivery race** — the inbound SendMessage to a freshly-spawned agent may be lost if delivered before the agent's first turn completes. Haiku's fast first-turn completion may *increase* the race window, not decrease it.

3. **Tool-availability bootstrap** — haiku's first turn may run before the MCP relay-channel plugin has registered, so the agent sees no `relay_reply` tool and silently has nothing to do. Sonnet's slower first turn may coincidentally land after plugin init and never trip this.

4. **System prompt length** — haiku context window + team system prompt + inherited project CLAUDE.md may hit a compression boundary that sonnet comfortably clears.

None of (1)–(4) produce relay traffic on failure. All are consistent with the observed silence.

---

## Recommended Next Experiment (Phase 2 — Queued, Requires CEO Greenlight)

Since the relay cannot answer this, point the comparison at `~/.claude/projects/**/*.jsonl`. Specific, controlled, cheap — but **not to be run during the current refactor-pause.** Chief-of-staff greenlit this in principle; CEO greenlight required before execution. Reasons for delay: (a) still in refactor-pause window, (b) requires live TeamCreate which burns tokens, (c) JSONL parsing has to avoid false-positives on session-start noise.

1. **Fix the cohort.** Spawn 5 haiku coders and 5 sonnet coders via TeamCreate with identical system prompts, identical TaskList, identical `SendMessage` at T+0 with an explicit task. Name them `lifecycle-haiku-{1..5}` and `lifecycle-sonnet-{1..5}`.

2. **Measure from the session files.** For each agent, locate its Claude Code project JSONL. Compute:
   - **First-turn start timestamp** (first user message after system prompt load)
   - **First-turn end timestamp** (first assistant message)
   - **First tool call timestamp** (first `tool_use` block)
   - **TaskGet call timestamp** (if ever — this is the key signal)
   - **First outbound relay_reply / SendMessage** (confirms it reached the communication stage)
   - **Teardown protocol message** (shutdown_approved vs idle_notification)

3. **Correlate with a single relay probe.** In parallel, tail `message-relay/logs/quarantine.jsonl` and check `~/.claude/relay-channel/{name}.port` for each. Expect zero quarantine rows. Expect some port files to never materialize — those are the failed agents. The failure pattern is "no port file ever created" which confirms pre-MCP-init failure.

4. **One instrumented spawn.** On one of the 5 haiku coders, add a forced first-turn prompt via SendMessage that says literally *"Call TaskGet now and report what you see"* — bypass the self-polling assumption entirely. If this haiku succeeds where the others fail, the root cause is confirmed as (1) above: haiku does not self-poll TaskList.

This is a ~30-minute experiment when unblocked. No relay changes needed. The output is a table of 10 agents × 6 columns with clear pass/fail per column, which answers the chief-of-staff's open question definitively.

---

## Structural Bugs Surfaced (LANDMINES-Material — Post-Pause Backlog)

Two structural bugs turned up during this pass. Neither caused the haiku failure, but both are the kind of defect that silently degrades every future investigation. Per chief-of-staff: keep them in this same proposal rather than split across files — the narrative is connected.

### Bug 1 — `log.http()` is defined and never called

The relay has a ready-made per-request logger sitting in `src/logger.ts`:

```
log.http(method, url, ip)
```

It is documented in the module header comment. It has a unit test in `src/__tests__/logger-and-logs-endpoint.test.ts`. And it is called **exactly zero times** in `src/relay-lean.ts`. The Fastify `onRequest` / `onResponse` hooks that would wire it up do not exist.

**Why this is LANDMINES-material:** dead observability code is worse than no observability. It looks like the relay logs HTTP requests. The function exists; the docs mention it; a casual reader of `logger.ts` would assume per-request logs are in `relay.jsonl`. They are not. An investigation (like this one) sets out to grep `relay.jsonl` for request traces and finds nothing, and the default inference is "no requests happened" — not "requests happened but were silently unlogged."

**Fix:** 5 lines in `src/relay-lean.ts` — an `app.addHook('onResponse', ...)` that calls `log.http(req.method, req.url, req.ip)`. Gated on post-refactor greenlight.

### Bug 2 — `queues/{agent}.jsonl` only exists on successful delivery

`persistMessage()` in `src/persistence.ts` appends to the recipient's queue file only when a message is actually stored. There is no "I tried to deliver to X and failed" record, and no stub file created when an agent is expected to appear. The filesystem makes two distinct states look identical:

- `queues/foo.jsonl` missing because `foo` has never received anything (healthy empty)
- `queues/foo.jsonl` missing because every attempt was dropped upstream (silent pathology)

**Why this is LANDMINES-material:** absence of evidence is silently conflated with evidence of absence. Any future lifecycle investigation that tries to use the queue directory as a ground-truth source of "who exists in this system" will reach the wrong conclusion exactly when the system is broken.

**Fix:** ~5 lines — create the queue file on first attempt even when delivery skips persistence, or add a parallel `queues/_attempts.jsonl` with one line per `/send` attempt regardless of outcome. Gated on post-refactor greenlight.

---

Both bugs are queued in the post-pause relay hardening backlog. Worth fixing independent of the haiku investigation — they will matter again the next time someone tries to reason about relay-side behavior from log evidence alone.

---

## Status

Research pass complete. No code written, no commits. Proposal submitted per chief-of-staff instruction. Returning to parked state awaiting CEO greenlight on task #26 (security project) and any further research assignments.

The headline, one more time for the record: **the relay has no data on haiku coder lifecycle failures because those failures occur upstream of the relay. The controlled comparison needs to move to `~/.claude/projects/**/*.jsonl`, and this pass produces a concrete experiment design for doing so.**
