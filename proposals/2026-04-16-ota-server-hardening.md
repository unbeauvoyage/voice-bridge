---
name: OTA Server Hardening — :8769 binding, auth, path sanitization
type: proposal
status: revised-per-ceo-2026-04-16
owner: voice-bridge
timestamp: 2026-04-16T05:07:46
summary: Defense-in-depth for OTA HTTPS server on :8769 — keep 0.0.0.0 bind (CEO wants LAN+Tailscale access), ship one-shot download token + path sanitization. Tailscale-only bind parked as future tightening. Path traversal filed in ISSUES.md as network-closed per tailnet decision.
related:
  - projects/productivitesse/scripts/ota-server.sh
  - message-relay dist/ commit 4628f19 (relay binding fix, pending CEO restart)
---

# OTA Server Hardening

## Problem

`scripts/ota-server.sh` in productivitesse runs an HTTPS server on port 8769 serving iOS OTA packages (itms-services://). Audit during comms-reliability sweep turned up three real holes.

### Current behavior

```bash
Bun.serve({
  port: 8769,
  tls,
  fetch(req) {
    const path = new URL(req.url).pathname
    const f = Bun.file('/tmp/ota' + path)
    return new Response(f)
  },
})
```

### Holes

| # | Hole | Severity | Exploitability |
|---|------|----------|----------------|
| 1 | **Binds 0.0.0.0** — `Bun.serve` with no `hostname` listens on all interfaces (LAN, VPN, Tailscale). Any reachable peer can connect. | High | Trivial — scan for port 8769, connect. |
| 2 | **No auth** on download. Path is the only gate; knowing/guessing the filename yields the `.ipa`. | High | Moderate — deploy scripts put builds at predictable paths (`/beta.plist`, `/beta.ipa`). |
| 3 | **Path traversal** — `'/tmp/ota' + path` is not sanitized. `GET /../../etc/passwd` escapes the serve root; any file the Bun process can read is readable. | Critical | Trivial — single curl. |

Secondary notes:
- TLS uses dev certs (`./certs/dev.pem`). Phone must trust chain or rely on provisioning profile; not a new issue but worth confirming during the audit.
- Server is only alive during deploy windows; currently not listening. Exposure window is minutes per deploy, but deploys happen during the exact windows CEO is using the phone.

## Proposal

### 1. Binding — defer, keep 0.0.0.0 (CEO 2026-04-16 ruling)

CEO wants both LAN and Tailscale access (deploy from any local network, not just Tailscale). Binding stays 0.0.0.0.

**Available tightening for future un-park** (not the default now):
- `hostname: '100.112.240.82'` (this Mac's Tailscale IP) — Phone reaches it via Tailscale; LAN peers cannot.
- Fallback: read dynamically via `tailscale ip -4` at script start.

Un-park this tightening when: (a) OTA becomes externally exposed, (b) Windows port lands, (c) production deploy begins, or (d) tailnet adds non-CEO peers.

### 2. One-shot download token

Deploy script generates a short-lived token (e.g., `TOKEN=$(openssl rand -hex 16)`), writes it to a per-deploy file, and includes it as a query param in the manifest URL:

```
itms-services://?action=download-manifest&url=https://100.112.240.82:8769/beta.plist?token=abc123
```

Server checks the token on every request; rejects non-matching with 403. Token is deleted after the `.ipa` is served (or on timeout).

### 3. Path sanitization

```ts
const url = new URL(req.url)
const safe = path.normalize(url.pathname).replace(/^\/+/, '')
if (safe.includes('..')) return new Response('forbidden', { status: 403 })
const f = Bun.file(path.join('/tmp/ota', safe))
```

Rejects `..` segments after normalization. Use `path.join` to prevent prefix-concat bugs.

## Tradeoffs

**Tailscale-only bind vs 127.0.0.1 + Tailscale forward:**
- Tailscale-only: simpler, one change. Phone reaches it directly. Risk: Tailscale IP is still a network-reachable surface; if a Tailscale peer is compromised it can scan.
- 127.0.0.1 + explicit Tailscale serve (via `tailscale serve`): two-step — stronger isolation. More setup cost.

Recommendation: Tailscale-only for Phase 1 (fast, unblocks CEO); revisit `tailscale serve` if the Tailscale network grows beyond the CEO's own devices.

**One-shot token complexity:**
- Alternative: no token, rely on Tailscale + short-lived file deployment. Simpler, but a Tailscale peer could still grab the build.
- Token adds one line to deploy script, one check in server. Net ~10 LOC. Worth it.

## Regression concerns

- Phone OTA install flow uses itms-services URL from a manifest; adding a token query param to the manifest URL is standard iOS practice and tested.
- Binding to a specific IP requires the Tailscale daemon to be up before the OTA server starts. Deploy scripts already require Tailscale (CEO's phone reaches via Tailscale).

## CEO decisions (2026-04-16)

1. **Binding**: keep 0.0.0.0 — CEO wants LAN + Tailscale access (not Tailscale-only). Tailnet is his-only, no hostile-peer threat model. Tailscale-only bind parked as future tightening.
2. **Token gate**: pending (expected approve).
3. **Path traversal**: network-closed per tailnet decision. Filed in ISSUES.md for un-park when OTA becomes externally exposed / Windows port / prod deploy.

## Estimated effort

~30 min to implement all three + add a test case in `scripts/ota-server.test.ts` (binding, token, path traversal).
