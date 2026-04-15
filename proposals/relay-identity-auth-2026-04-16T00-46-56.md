---
title: "Relay Identity Authentication — Tiered Ladder from Crude to Advanced"
date: 2026-04-16T00:46:56
status: proposed
priority: high
author: message-relay
summary: A multi-level security ladder for relay identity — each level closes a specific class of impostor and explicitly calls out what it still cannot close. Levels 0–2 are cheap and address external and trivial local attackers. Levels 3–5 require increasingly heavy infrastructure to defend against an attacker who can run our own launch scripts. Level 6 is the only real defense against a same-user OS-level adversary.
---

## Framing

Security is a ladder, not a switch. Each rung blocks a strictly weaker attacker than the one above. The question is never "is this secure?" — it is "which rung are we on, and what does that rung leave exposed?"

The key insight from CEO feedback: **an attacker with local code execution can run our official `spawn-session.sh` script.** That means *any* scheme that trusts "was this started by the official launcher?" is defeated the moment the attacker has file-read + exec on the Mac. The rungs above Level 3 exist precisely to close that gap, and they get expensive fast.

We should climb this ladder deliberately, one rung at a time, stopping where marginal cost exceeds marginal risk.

---

## The Ladder

### Level 0 — Already Shipped (baseline)

**What's in place today:**
- Relay binds `127.0.0.1` by default (no tailnet/internet exposure unless explicitly opened)
- Sender allowlist: `from` must correspond to an existing `~/.claude/relay-channel/{name}.port` file
- Optional shared `RELAY_SECRET` via `X-Relay-Secret` header, timing-safe comparison
- Quarantine log for rejected senders

**Closes:** remote attackers, tailnet peers (when localhost-only), trivially forged `from` fields from processes that don't bother to create a port file.

**Does NOT close:** any local process that can (a) create a port file, or (b) read `RELAY_SECRET` from a parent agent's environment. The allowlist is "is this name registered?" not "is this the real owner of the name?"

---

### Level 1 — CEO Device Binding (Tailscale IP allowlist)

The CEO's phone and Mac have fixed Tailscale IPs. Enforce that `from: ceo` is only accepted when `req.ip` is in a configured `CEO_DEVICE_IPS` set. Local processes arriving via `127.0.0.1` cannot pass.

**Effort:** ~20 lines, 1 hour.

**Closes:** any process on the Mac impersonating CEO. Any tailnet peer other than CEO's devices impersonating CEO.

**Does NOT close:** CEO impersonation from a compromised CEO device itself, or after Tailscale key theft. Agent-on-agent impersonation is untouched.

**Tradeoff:** breaks if device Tailscale IPs change — requires manual config bump. Acceptable for a 2-device setup.

---

### Level 2 — Per-Request Capability Secret (RELAY_SECRET activated)

Already implemented, currently unactivated pending CEO greenlight. Every `/send` and `/status` call must present `X-Relay-Secret`. Agents get the secret from their environment at launch.

**Closes:** processes that can hit the relay port but cannot read another agent's environment (e.g. a shell running as a different user, a sandboxed helper, a browser-originated request with no env access).

**Does NOT close:** processes running as the same Unix user that can read `/proc/PID/environ`-equivalent (`ps eww`, `sysctl`, attaching a debugger). On macOS, same-user env reading is possible. This is "know-the-password" security, not "prove-you-are-X" security.

---

### Level 3 — Per-Session Tokens (replaces shared secret with per-agent tokens)

On launch, `spawn-session.sh` calls `POST /session/register` with `{name, pid}` and receives a session token. Token is an HMAC of `(name, pid, issued_at)` signed server-side, mapped in memory to `(name, expiry)`. Agent includes `X-Session-Token` on every `/send`; relay rejects if token → name mismatches `from`.

**Closes:** an attacker who steals one agent's token can only impersonate *that* agent, not the whole fleet. Token TTL bounds replay. Invalidation on port-file deletion revokes on clean exit.

**Does NOT close:** **an attacker who runs `spawn-session.sh` themselves.** Per CEO: our launch scripts are on disk and executable. An impostor who runs them produces a real, server-issued token for a name they chose. From the relay's perspective this is indistinguishable from a real agent. Level 3 only defeats *ad-hoc* spoofing (processes that never went through the launcher); the moment the attacker uses the real launcher, Level 3 is silent.

**This is the rung where "launcher-trust" breaks down and every higher level is about answering "how do we tell a real spawn from a fake spawn?"**

---

### Level 4 — CEO Confirmation on New Sessions (human-in-the-loop)

At session spawn time, the relay pushes a notification to CEO's phone: *"New session `consul` starting at 14:22. Approve? [Y/N]"*. No token is issued until CEO taps approve. Combined with Level 1 (CEO device binding), the approval request is bound to CEO's real device.

**Closes:** silent spawns by an attacker. Even if they run the official launcher, the session cannot speak until CEO approves. An attacker who spawns 30 fake agents produces 30 phone notifications — loud, visible, unforgeable without CEO physical device access.

**Does NOT close:** approval fatigue (CEO rubber-stamps everything), a legitimate session being hijacked *after* approval, or an attacker who compromises CEO's phone.

**Tradeoff:** adds human friction to every agent launch. Mitigation: trusted-launcher window (CEO taps "approve next N sessions in next 5 minutes" when doing intentional multi-spawn work). This is the first level that genuinely closes the launcher-trust gap, and it is also the first level that materially affects CEO's workflow. Worth the friction in a small-fleet system.

---

### Level 5 — Process Lineage & Binary Attestation

Before issuing a session token, the relay verifies:
1. The registering PID's parent process chain traces back to a known, allowed launcher (e.g. `spawn-session.sh` whose binary hash matches a pinned value).
2. The launcher binary itself hasn't been modified (hash check on `spawn-session.sh` and `claude` binary at registration time).
3. Optional: code-signing check via `codesign -v` on `claude`.

**Closes:** an attacker who *replaces* or *modifies* the launcher to skip checks. An attacker who runs a lookalike script at a different path. An attacker whose parent process chain doesn't match the expected shape (e.g. spawned from a web shell rather than from a user terminal or launchd job).

**Does NOT close:** an attacker who runs the *unmodified* launcher from the legitimate path with a legitimate parent chain. If the adversary faithfully mimics the real spawn workflow, lineage checks pass. This buys meaningful defense-in-depth but is not a ceiling.

**Tradeoff:** platform-specific (macOS `sysctl` / `proc_pidinfo`), fragile across OS updates, adds startup latency. Significant engineering cost (~500 lines + ongoing maintenance).

---

### Level 6 — Hardware-Backed Attestation & User Isolation

The only rungs that defeat a same-user, same-machine attacker:

- **Secure Enclave-backed keys**: each agent gets an asymmetric keypair where the private key lives in the Secure Enclave and cannot be exfiltrated even by root. Relay verifies signatures per request. An attacker who steals disk contents cannot sign as the agent.
- **Per-agent macOS user accounts**: each agent runs as its own Unix user. File permissions and process isolation become OS-enforced. Cross-agent reads of env/port files are denied by the kernel, not by policy.
- **App Sandbox / macOS entitlements**: agents run with restrictive entitlements; relay exposes itself via XPC, not TCP; access is mediated by the OS.

**Closes:** nearly everything short of full root compromise or physical access.

**Does NOT close:** physical access, root, kernel compromise, CEO device compromise.

**Tradeoff:** massive. Reshapes the entire project. Sandboxing breaks many Claude Code assumptions (bash access, file reads across directories). Per-user accounts require rebuilding all file-sharing assumptions. Weeks to months of work. **Only justified if the threat model expands beyond a single trusted operator.**

---

## Recommendation

Climb in order, pause after each rung to measure:

1. **Level 1 (CEO IP allowlist)** — ship now. Trivial, closes a real gap, no friction.
2. **Level 2 (RELAY_SECRET activation)** — ship after CEO phone-access risk is mitigated. Closes the "process on machine can't read env" class for free (code is already written).
3. **Level 3 (per-session tokens)** — ship as defense-in-depth. Honest about what it doesn't close. ~3 days.
4. **Level 4 (CEO confirmation on new sessions)** — **this is the first level that actually defeats "attacker runs our launcher."** Ship as soon as per-session tokens land, because tokens without Level 4 give a false sense of safety. ~2 days.
5. **Level 5 (lineage/binary attestation)** — only if post-Level-4 threat modeling shows a credible attacker who would run unmodified launchers. Revisit later.
6. **Level 6 (SE keys / user isolation)** — only if the system expands beyond a single trusted operator. Not now.

**The important honesty line:** until Level 4, an attacker with local code execution on the Mac can always produce a "legitimate-looking" agent. Levels 1–3 raise the cost and force the attacker to be noisier, but they do not stop a patient adversary. Level 4 is where the defense stops being about cryptography and starts being about a human in the loop — and that is the cheapest real defense available.

---

## What Each Level Explicitly Does Not Fix

| Level | Still leaves open |
|---|---|
| 0 | Same-machine impostors who create a port file |
| 1 | Agent-on-agent impersonation; same-machine impostors |
| 2 | Same-user env-reading attacks |
| 3 | **Attackers who run the real `spawn-session.sh`** |
| 4 | CEO approval fatigue; post-approval session hijack |
| 5 | Attackers who faithfully mimic the real spawn workflow |
| 6 | Root, kernel, physical access |

---

## Assign To

- **consul / system-expert** — Levels 1, 3, 5 relay-side implementation
- **chief-of-staff** — Level 4 (CEO confirmation UX, phone notification path), spawn-session.sh changes
- **message-relay** — channel plugin header plumbing (Levels 2, 3)
- **security-expert** — review Level 5 lineage/attestation design when we get there

**All levels gated on CEO greenlight for the security project (currently task #26).**
