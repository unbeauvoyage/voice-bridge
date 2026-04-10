---
title: Agency Research Network — Operations Playbook
created: 2026-04-09T02:15:14
summary: Step-by-step playbook to launch, connect, and manage overnight agency research teams. Read this before starting any new agency research session.
---
# Agency Research Network — Operations Playbook

This playbook captures exactly how to spin up agency research sessions that run autonomously overnight, stay channel-connected, and keep producing findings without hand-holding.


---

## What This System Does

Each **agency** is a persistent Claude Haiku session that:

- Reads its `CLAUDE.md` for market-specific mission
- Creates a persistent Codex session (`echo "question" | claude -p --resume $SESSION_ID`)
- Pipes research questions to Codex continuously — accumulating context, never starting over
- Appends all findings to `.worklog/{agency}-lead.md`
- Sends completion pings to `command` via relay when it finishes an iteration
- Receives wake-up messages and new research angles from `command`

---

## Directory Structure

```
agency/
  {name}/
    CLAUDE.md                    ← market-specific mission (required)
    .worklog/
      {name}-lead.md             ← append-only research log
    .codex-session-id            ← UUID for persistent Codex session
    .claude/
      agents/
        agency-lead.md           ← copied by spawn-session.sh automatically
```

---

## Step 1: Create the Agency Directory and CLAUDE.md

```bash
mkdir -p /Users/riseof/environment/agency/{name}/.worklog
mkdir -p /Users/riseof/environment/agency/{name}/.claude

# ALWAYS copy the standard settings — prevents Bash being blocked
cp /Users/riseof/environment/agency/.claude-settings-template.json \
   /Users/riseof/environment/agency/{name}/.claude/settings.json
```

Write `CLAUDE.md` for the new agency. Required sections:

- **Mission** — one paragraph on what market this covers
- **Why This Business** — the customer model (¥X in → ¥Y out, passive?)
- **Priority Research Topics** — numbered list of specific research questions
- **What to Log** — what goes in the worklog, what format
- **Communication** — `hub_send(to: "command", message: "DONE — ...")` on completion

Use `agency/bicycles/CLAUDE.md` or `agency/vending-machines/CLAUDE.md` as templates.

---

## Step 2: Launch the Session

```bash
cd /Users/riseof/environment

bash scripts/spawn-session.sh agency-lead {name} /Users/riseof/environment/agency/{name} haiku
```

**DO NOT pass a UUID** (5th argument). Let the script generate one — but see the critical fix below.

### Critical Fix: `--resume` with Fresh UUIDs Fails

`spawn-session.sh` always uses `--resume $UUID`. When the UUID is freshly generated and has never had a Claude session, it fails with:

```
No conversation found with session ID: {UUID}
```

**The workaround:** After the failed launch, the workspace is at a zsh prompt. Inject a fresh `claude` command **without `--resume`**:

```bash
# 1. Get the workspace ref
cmux list-workspaces | grep {name}
# → workspace:118  agency-{name}

# 2. Inject fresh claude start (no --resume)
RELAY_SESSION_ID=$(uuidgen)
CMD="RELAY_AGENT_NAME=agency-{name} RELAY_SESSION_ID=$RELAY_SESSION_ID claude --agent agency-lead --model haiku --dangerously-load-development-channels plugin:relay-channel@relay-plugins --permission-mode bypassPermissions --name agency-{name} --remote-control"
cmux send --workspace "workspace:118" "$CMD"
cmux send-key --workspace "workspace:118" Enter
```

### Step 3: Approve the Channel Plugin

After starting, the terminal shows a prompt:

```
❯ 1. I am using this for local development
  2. Exit
```

Approve it:

```bash
cmux send --workspace "workspace:118" "1"
cmux send-key --workspace "workspace:118" Enter
```

Wait ~10 seconds, then verify on relay:

```bash
curl -s http://localhost:8765/status | python3 -c "
import json,sys
d=json.load(sys.stdin)
for name,info in d.get('agents',{}).items():
    if '{name}' in name:
        print(f'{name}: {info.get(\"state\",\"?\")}')
"
```

Should show `agency-{name}: idle` or `busy`.

---

## Step 4: Send the Opening Research Brief

Once the agent is on relay, send the first message:

```bash
curl -s -X POST "http://localhost:8765/send" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "command",
    "to": "agency-{name}",
    "type": "message",
    "body": "START NOW. Read your CLAUDE.md for your full mission. Then: cd /Users/riseof/environment/agency/{name} && SESSION_ID=$(uuidgen) && echo $SESSION_ID > .codex-session-id && echo \"{your first specific research question}\" | claude -p --resume $SESSION_ID --permission-mode bypassPermissions >> .worklog/{name}-lead.md 2>&1. Keep piping follow-up questions to same SESSION_ID. Never stop."
  }'
```

**Key points in the brief:**

- Tell them to use **WebSearch** and **WebFetch** natively — NOT `claude -p --resume`
- Give 3–5 specific search queries to start with
- Tell them to write findings to worklog with their **Write** tool
- End with "Keep going. Never stop."

**Do NOT tell agents to use `claude -p --resume $SESSION_ID`** — this always fails with fresh UUIDs and causes agents to get stuck asking for help. The worklog is their persistent memory; each WebSearch builds on what they have already logged.

---

## Step 5: Add to Overnight Monitor

Edit `/Users/riseof/environment/scripts/agency-overnight-check.sh` and add the new agency to the `WORKLOGS` dict:

```bash
["agency-{name}"]="/Users/riseof/environment/agency/{name}/.worklog/{name}-lead.md"
```

The monitor runs every 20 minutes via launchd (`com.anthropic.agency-overnight.plist`). If the worklog hasn't been updated in 20 minutes, it sends a wake-up message automatically.

---

## Active Management Protocol (Overnight)

### Checking Status

```bash
# Quick worklog size + modification time check
for agency in bicycles cars coffee-shops kabab-shops housing-mortgage routers business-opportunities vending-machines coin-laundry; do
  dir="/Users/riseof/environment/agency/$agency/.worklog"
  f=$(ls "$dir"/*.md 2>/dev/null | head -1)
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f")
    mod=$(stat -f "%Sm" -t "%H:%M" "$f")
    echo "$agency: $lines lines | last mod $mod"
  fi
done
```

```bash
# Relay state check
curl -s http://localhost:8765/status | python3 -c "
import json,sys
d=json.load(sys.stdin)
for name,info in d.get('agents',{}).items():
    if 'agency' in name:
        print(f'{name}: {info.get(\"state\",\"?\")} pending={info.get(\"pending\",0)}')
"
```

### Reading What They've Found

```bash
tail -30 /Users/riseof/environment/agency/{name}/.worklog/{name}-lead.md
```

### Sending a Targeted Nudge

```bash
curl -s -X POST "http://localhost:8765/send" \
  -H "Content-Type: application/json" \
  -d '{"from":"command","to":"agency-{name}","type":"message","body":"[specific new angle based on what you read in their worklog]"}'
```

### Relay Send — Use Python, Not curl with Shell Strings

Messages containing apostrophes or special characters break `curl -d '...'`. Always use Python:

```python
python3 -c "
import urllib.request, json
payload = json.dumps({'from':'command','to':'agency-X','type':'message','body':'your message here'}).encode()
req = urllib.request.Request('http://localhost:8765/send', data=payload, headers={'Content-Type':'application/json'}, method='POST')
urllib.request.urlopen(req)
"
```

### Research Tool — Headless Claude pipe, NOT WebSearch in the agent session

**Correct pattern:** Agents pipe questions to a headless `claude -p` session. This keeps heavy research token cost outside the agency session:

```bash
echo "detailed research question" | claude -p --permission-mode bypassPermissions >> .worklog/{name}-lead.md 2>&1
```

**Do NOT use `--resume $NEW_UUID`** — a UUID from `uuidgen` has never been a Claude session and fails with "No conversation found". Drop `--resume` entirely; each call starts a fresh headless session. No context accumulation, but the worklog is the persistent memory.

**Do NOT tell agents to use WebSearch directly** — that burns tokens inside the agency session itself, which runs on the same account as command. The headless pipe creates a separate session with its own cost.

**When instructing agents, give them the exact bash command** including the worklog append path. Vague instructions lead to agents falling back to WebSearch or asking clarifying questions.

### Common Stall Patterns and Fixes

| Symptom                              | Cause                                                              | Fix                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Agent stuck asking for clarification | Accumulated confusion in session context (often from prior Codex CLI failures) | Close workspace, relaunch fresh, send clean opening brief with WebSearch instructions only |
| Relay: busy, worklog stale           | Codex CLI pipe failed silently; agent waiting for response         | Tell agent to use WebSearch directly instead — drop Codex CLI entirely                             |
| Relay: idle, no worklog update       | Agent finished iteration and stopped                               | Send nudge with a specific new WebSearch angle                                                      |
| Agent says "awaiting synthesis"      | Stuck waiting for permission to proceed                            | Tell it: "Stop waiting. Write the synthesis NOW. Then start next research."                         |
| Relay: agent not showing             | Channel plugin not approved or session failed to start             | Check pane, re-inject command without --resume, re-approve with "1" + Enter                        |
| Agent shows up with empty name on relay | RELAY_AGENT_NAME was empty in injected command (variable expansion failed) | Always hardcode the name string — never use a bash variable inside cmux send strings |
| Session refuses to die when you send "q" | "q" is treated as a message to the agent, not a terminal quit | Use `cmux close-workspace --workspace "workspace:N"` to force-close. Ctrl+C via cmux is not supported. |
| Session resumes with old confused context after restart | spawn-session.sh uses --resume UUID which finds the old session | After spawn-session fails with "No conversation found", inject fresh command WITHOUT --resume via cmux send |
| `claude -p --resume UUID` exit code 1 | UUID from uuidgen has never been a real Claude session              | Remove `--resume` flag entirely; use `echo "q" \| claude -p` for fire-and-forget research queries   |
| curl relay send returns 400          | Shell quoting breaks JSON (apostrophes in message body)            | Use Python urllib to send — handles escaping correctly                                              |
| Wrong content in worklog        | Agent confused its identity                              | Send clear redirect: "Your domain is X. Ignore other topics."                           |

---

## Customer Framework (Always Keep In Mind)

Every research finding must be evaluated against all three customer types:

### Type A — Ultra-low capital (¥100K–¥500K)

- Example: Rent fast-food buffet for ¥80K/month, earn ¥500K–¥1M/month (perfect location)
- Passive income counts: ¥100K/month with one worker and zero owner presence feeds half a family
- ROI % matters more than absolute profit
- Look for: food stalls, weekend markets, vending machines, subletting a corner

### Type B — Medium capital (¥1M–¥3M)

- Standard business opportunities with realistic break-even timelines
- Examples: coffee shop, used cars, e-bike conversion, housing investment

### Type C — Exceptional deals regardless of capital

- Owner leaving Japan who spent ¥15M on buildout, selling for ¥1M → we want these
- Car worth ¥3M selling for ¥1M → find systematically
- Trigger events: divorce, visa expiry, bankruptcy, business closure, death in family
- **These are the most valuable findings — prioritize surfacing them**

### Social Acceptability Rule

**Never research:** bars/izakayas where alcohol is the primary product, pachinko, tobacco-primary businesses and such. Our customers are families, general public, children. All opportunities must be suitable for the general public.

---

## Active Agencies (as of 2026-04-09)

| Agency Name            | Relay Name              | Domain                                                   | Worklog                                                                   |
| ---------------------- | ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| bicycles               | agency-bicycles         | E-bike conversion, mamachari flipping, cycling tours     | `agency/bicycles/.worklog/bicycles-lead.md`                             |
| cars                   | agency-cars             | Used car trading, JDM export, kei truck arbitrage        | `agency/cars/.worklog/cars-lead.md`                                     |
| coffee-shops           | agency-coffee-shops     | Specialty coffee, mobile carts, Nara Park gap            | `agency/coffee-shops/.worklog/coffee-shops-lead.md`                     |
| kabab-shops            | agency-kabab-shops      | Halal kebab, Muslim tourist market, food stalls          | `agency/kabab-shops/.worklog/kabab-shops-lead.md`                       |
| housing-mortgage       | agency-housing-mortgage | Akiya, minpaku licensing, rental yield, distressed sales | `agency/housing-mortgage/.worklog/housing-lead.md`                      |
| routers                | agency-routers          | Wi-Fi-as-a-service for guesthouses, mesh network resale  | `agency/routers/.worklog/routers-lead.md`                               |
| business-opportunities | agency-biz              | Cross-category, family-friendly, visa pathways           | `agency/business-opportunities/.worklog/business-opportunities-lead.md` |
| vending-machines       | agency-vending          | Vending machine routes, gashapon, location contracts     | `agency/vending-machines/.worklog/vending-lead.md`                      |
| coin-laundry           | agency-laundry          | Coin laundry ownership, franchise vs independent         | `agency/coin-laundry/.worklog/coin-laundry-lead.md`                     |

---

## Overnight Monitoring Infrastructure

| Component                                | Location                    | Interval               | Purpose                      |
| ---------------------------------------- | --------------------------- | ---------------------- | ---------------------------- |
| `agency-overnight-check.sh`            | `scripts/`                | Every 20 min (launchd) | Wake idle agents, log status |
| `agency-15min-check.sh`                | `scripts/`                | Every 15 min (launchd) | Broader status + relay check |
| `com.anthropic.agency-overnight.plist` | `~/Library/LaunchAgents/` | 1200s                  | Schedules overnight check    |
| `com.anthropic.agency-monitor.plist`   | `~/Library/LaunchAgents/` | 900s                   | Schedules 15min check        |

Check overnight log:

```bash
tail -20 /Users/riseof/environment/.worklog/agency-overnight.log
```

---

## Starting a New Research Session From Scratch

1. Decide the domain (e.g. "vending machines")
2. Create `agency/{name}/CLAUDE.md` — mission, customer profile reference, specific research topics
3. `mkdir -p agency/{name}/.worklog`
4. `bash scripts/spawn-session.sh agency-lead agency-{name} /Users/riseof/environment/agency/{name} haiku`
5. If it fails with "No conversation found", inject fresh command without `--resume` (see Step 2 above)
6. Approve channel plugin: `cmux send --workspace "workspace:N" "1"` + Enter
7. Verify on relay: `curl -s http://localhost:8765/status`
8. Send opening brief with first specific research question via relay
9. Add to `agency-overnight-check.sh` WORKLOGS dict
10. Check back in 10–15 minutes — read worklog tail to confirm research is accumulating
