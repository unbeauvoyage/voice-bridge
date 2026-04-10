# Morning Briefing — 2026-04-03

## Executive Summary
Dashboard gained 3 major features overnight (holographic panels, platform architecture, two-way messaging). 9 open issues queued for productivitesse. All 7 agency projects have completed initial research rounds. System infrastructure stable.

---

## Dashboard Status
**Live at:** `http://localhost:5173/dashboard`

**Shipped overnight (12 VIP commits):**
1. `94ef6e9` — Holographic 3D panels, shared actions, Playwright tests (13 passing)
2. `a7ab130` — Platform architecture, shared relay config, mobile perf
3. `5dd692a` — Two-way messaging: ComposeBar + MessageFeed
4. `ee20f37` — Straight panels, expandable UI, CORS/message sending fix
5. `bb3898d` — Panel UX: expand-down-only, occlusion strategy
6. `311f5fe` — Fix 7 dashboard bugs (timestamps, duplicates, markdown, zoom, order)
7. `e98d0c5` — Panel responsiveness + notification system
8. `eb536c8` — Issues panel with real-time ISSUES.md sync
9. `f21d38f` — Click-to-expand, remember last tab, persist panel state
10. `7ee02ec` — Fix report cards (frontmatter → actual content)
11. `591cd54` — Orthographic camera + interactive panels (approve/reject inline)
12. `a24a2a0` — Programmatic dashboard control API

**Previously shipped:**
- `907141a` — Real-time dashboard: 3D hierarchy, proposals system, reports, messages

**What works:**
- 3D agent hierarchy with planets, bloom, particles
- Real-time agent status via WebSocket (13 agents)
- Message feed with color-coded badges
- Holographic side panels (proposals, reports, backlog, messages)
- Two-way messaging — type to agents from dashboard
- Playwright test suite (13 tests)

**Open issues (9):** See ISSUES.md. Productivitesse working through them.

---

## Voice System
- **Wake word daemon:** Stopped (too many false triggers at all thresholds). Needs custom "Ok Command" model trained on CEO's voice.
- **Button-press recording:** Working. "Hey Jarvis" start / "Alexa" stop pattern implemented and tested.
- **Whisper server:** Online (pm2, 17h uptime, 2GB memory)
- **Voice-bridge server:** Online (pm2, 2h uptime)
- **Recording indicator:** Swift native overlay built, shows "Recording..." badge top-right
- **Jarvis communicator:** Active on workspace:12 (Haiku), routing voice messages to correct agents

---

## Infrastructure
| Service | Status | Uptime | Notes |
|---------|--------|--------|-------|
| message-relay | Online | 46m | 4 restarts, 122MB, port 8765 |
| monitor-tier1 | Online | 17h | Health checks |
| monitor-tier2 | Online | 17h | Deep checks |
| voice-bridge-server | Online | 2h | 27 restarts (iterative dev) |
| voice-bridge-indicator | Online | 110m | Swift overlay |
| whisper-server | Online | 17h | 2GB memory (model loaded) |
| wake-word | Stopped | — | Paused until custom model |

**Relay queue:** ~150 messages (mostly old undelivered CEO messages). No active delivery issues.

**Known issue:** Duplicate "[TASK APPROVED]" message being sent repeatedly (12+ times). Source appears to be an external automation loop, not relay bug.

---

## Agency Research — All 7 Projects

### Routers (Complete)
- Japan Wi-Fi 6/7 market mapped via Kakaku.com
- Top pick: Buffalo WSR3600BE4P-BK (¥9,980, 4.51/5 rating)
- Premium: ASUS RT-BE92U (¥32,200)
- Wi-Fi 7 now available at budget prices
- Open: ISP compatibility deep-dive, mesh systems

### Business Opportunities (Final report ready)
- **Full report:** `.worklog/business-final-report.md` in agency/business-opportunities
- Top 10 ranked: Cultural Experience (Nara), Akiya Guesthouse, Osaka Minpaku, Vintage Export, Specialty Coffee (Nara Park), Halal/Kebab, Managed Wi-Fi, and more
- Key insight: Startup Visa (2-year, no capital req) is the entry path since Business Manager Visa minimum raised to ¥30M (Oct 2025)
- Cross-agency finding: managed Wi-Fi for hospitality
- Each opportunity has: startup cost, licensing, competition level, profit potential, visa path

### Coffee Shops (89% complete)
- 8/9 Codex research tasks done. 81KB comprehensive report
- **Key finding: Nara Park specialty coffee = clear market gap**
- 25 chains + 7 independents analyzed, 20+ real estate listings
- 14.87M annual tourism volume in Nara
- Next: location scouting, foot traffic validation

### Kabab Shops (Initial mapping)
- Only 3 kebab establishments in all of Nara
- Extreme market gap: no kebab buffet concept despite heavy tourism
- Turkish Ice Cream on Sanjo St best positioned (tourist traffic)
- Next: site availability, rent, supplier chains

### Housing / Mortgage (Research complete)
- Nara median: ¥19.8M for used detached house (108m², 32-year age)
- Full SUUMO/HOME'S data, Flat 35 rates, Tokyo vs Nara comparison
- Awaiting analysis/reporting phase

### Cars (Baseline established)
- Nara: 6,143 vehicles across 345 dealers
- Sweet spot: ¥1.2M-2.0M; kei cars = 43% of listings
- Next: export opportunities, shaken depreciation curves

### Bicycles (Partial)
- Cycle Base Asahi repair rates captured
- City bike repairs ¥1,100-4,290
- Needs expansion to buy/sell markets and resale channels

---

## Active Backlog (Top 3 for Sprint)
1. **Dashboard** — Active, productivitesse building. Input features shipping.
2. **Kanban auto-execution** — Event-driven task assignment for idle agents. Not started.
3. **Relay security hardening** — Sender auth needed (prompt injection confirmed). Consul owns.

---

## Sessions
| Session | Status | Notes |
|---------|--------|-------|
| command | Active | Managing overnight work |
| jarvis | Idle | Communicator, Haiku |
| productivitesse | Active | Fixing ISSUES.md bugs |
| voice-bridge | Registered | Session may need restart |
| consul | Registered | Idle |
| agency-biz | Active | Writing final report |
| agency-routers | Active | Writing final report |
| hq | Registered | No current task |
| knowledge-base | Registered | Phase 1 CLI done |

---

## New Workflows Codified
1. **CEO speech parsing** — Directives vs uncertainties detected and routed separately
2. **Proposal workflow** — Jarvis detects → Command routes → team researches → proposal in ~/environment/proposals/
3. **ISSUES.md** — Small bugs tracked separately from backlog

---

## Pending Proposals
- **Active Notification System** — ~/environment/proposals/2026-04-03-active-notification-system.md
  - Holographic cards float up in 3D dashboard when agents complete work
  - Three urgency levels: urgent (red), important (gold), routine (blue)
  - Triggers: DONE messages, new proposals/answers, permission requests, security alerts
- **GitHub Issues vs ISSUES.md** — ~/environment/proposals/2026-04-03-github-issues-vs-local.md
  - Recommendation: stay with ISSUES.md (fast, local, real-time dashboard sync)
  - Optional: one-way sync script to GitHub Issues for mobile access
- **Voice-Controlled Dashboard** — ~/environment/proposals/2026-04-03-voice-controlled-dashboard.md
  - JS module + MCP server for voice → programmatic dashboard actions
  - 60+ example commands, fuzzy matching, framework-agnostic adapter pattern
  - "Show proposals", "zoom to issues", "approve proposal 3", etc.
- **Codex Code Reviews** — ~/environment/proposals/2026-04-03-codex-code-reviews.md
  - Mandatory before main merge, optional for feature branches
- **Information Taxonomy** — ~/environment/proposals/2026-04-03-information-taxonomy.md
  - 8-type system: Report, Proposal, Question, Answer, Issue, Backlog, Dream, Directive
  - Each type has different lifecycle — keep separated, don't combine
- **Philosophy & Literature Exploration System** — ~/environment/proposals/2026-04-03-philosophy-exploration-system.md
  - Practice threads linking philosophy to game/screenwriting/engineering
  - Screenwriting: invest in judgment layer, delegate drafting to AI

## Recommendations
1. Review dashboard at localhost:5173/dashboard — it's becoming the primary interface
2. Coffee shop opportunity in Nara Park looks strong — consider green-lighting deep-dive
3. Duplicate message loop needs investigation (likely phone app or hook retrying)
4. Wake word needs custom model training before re-enabling
5. Review philosophy proposal — high-quality, actionable, directly applicable to your work
6. Testing frameworks report at ~/environment/answers/2026-04-03-testing-frameworks.md — Playwright vs NutJS, Electron testing, iPhone testing, maturity roadmap
7. Voice-bridge merged mic-toggle feature to main (commit 2044dba)
8. New file: ~/environment/INFORMATION-MAP.md — single-page map of where all information lives in the system
9. Claude Code effectiveness audit at ~/environment/answers/2026-04-03-claude-code-effectiveness.md

## Answers Ready
- ~/environment/answers/2026-04-03-testing-frameworks.md — Playwright vs NutJS, Electron testing, iPhone testing, maturity roadmap
- ~/environment/answers/2026-04-03-claude-code-effectiveness.md — hooks inventory, skills, MCP servers, optimization opportunities
