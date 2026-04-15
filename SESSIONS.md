# Active Sessions

<!--
  Interactive = running in a cmux workspace, can receive messages
  Channel = launched with --dangerously-load-development-channels plugin:relay-channel@relay-plugins (preferred)
  Legacy = no channel plugin, uses cmux injection fallback (deprecated)
  Non-interactive = saved on disk, resume with claude --resume (unreliable for live messaging)
  Last verified: 2026-04-04 by system-expert (audit)
  
  CRITICAL SESSION RULES:
  - Each project session MUST launch from its own folder (e.g., productivitesse from ~/environment/projects/productivitesse)
  - Meta-managers (command, consul) launch from ~/environment
  - Session launches: cd into the correct folder FIRST, then run claude --resume with RELAY_AGENT_NAME
  - This ensures sessions have the right cwd context and can find their project files
  
  TEAM LEAD CODING WORKFLOW (2026-04-04):
  - All code on dev branch, never main
  - Spawn multiple coder agents per feature (same team, different worktrees)
  - Coder merges their own code (stays context-clean for team lead)
  - Direct communication: Coder → Reviewer → Tester (no team lead in the loop)
  - Team lead: spawns agents, decides merge timing, reviews status reports (not diffs)
  - See CLAUDE.md "Team Lead Coding Workflow" for full rules
-->

## Interactive Sessions
| Session | UUID | Workspace | Delivery | Purpose | Status |
|---------|------|-----------|----------|---------|--------|
| command | f54b472b-25d0-4e29-a7fd-a400ce91b754 | workspace:60 | **Channel** | Primary meta-manager | Active — bypassPermissions, cwd: ~/environment |
| consul | a87a7ce9-987e-45da-a392-fc3cebbd1962 | workspace:62 | **Channel** | Secondary meta-manager (CEO session) | Active — bypassPermissions, cwd: ~/environment |
| productivitesse | 5ff9b28e-d6d4-4529-90d3-d3df8bee30d3 | workspace:productivitesse | **Channel** | Productivitesse (RRv7 + Electron + Capacitor) | Active — acceptEdits, cwd: ~/environment/projects/productivitesse |
| relay-server | — | — | — | Lean relay (pm2-managed, HTTP :8767, HTTPS :8768) | Active — `pm2 status`, `pm2 logs message-relay-lean` |
| hq | d1d8eace-b3bd-4e49-bf9f-71c7987428e1 | workspace:69 | **Channel** | Meta-manager peer | Active — bypassPermissions, cwd: ~/environment/hq |
| agency-bicycles | 3e1a569b-117f-4d2e-a893-a289d0ec6df1 | workspace:36 | **Channel** | Bicycle resale research — build profitable customer business model | Active — bypassPermissions, cwd: ~/environment/agency/bicycles |
| agency-cars | 96edbd5f-f78d-442e-84c7-643c2675463e | workspace:35 | **Channel** | Car dealership research — build profitable customer business model | Active — bypassPermissions, cwd: ~/environment/agency/cars |
| agency-coffee-shops | d92973d9-b436-41d9-a70e-29492336151f | workspace:34 | **Channel** | Coffee shop research — build profitable customer business model | Active — bypassPermissions, cwd: ~/environment/agency/coffee-shops |
| agency-kabab-shops | 6a5b294e-267a-4aa0-8c1e-8ffe0b20ac05 | workspace:32 | **Channel** | Turkish kebab buffet research — build profitable customer business model | Active — bypassPermissions, cwd: ~/environment/agency/kabab-shops |
| agency-housing-mortgage | 94a3d1fa-cc27-4ca0-9dfe-7d35953a74de | workspace:33 | **Channel** | Housing & mortgage research — build profitable customer investment model | Active — bypassPermissions, cwd: ~/environment/agency/housing-mortgage |
| agency-routers | 7c0b6d82-3d7f-429c-b638-7232dcb4e26b | workspace:70 | **Channel** | Internet router research — best routers in Japan | Active — bypassPermissions, cwd: ~/environment/agency/routers |
| agency-biz | 1fdd7b66-550f-4d1d-8967-0bd2c1d85fb1 | workspace:71 | **Channel** | Business opportunities research — all Japan | Active — bypassPermissions, cwd: ~/environment/agency/business-opportunities |
| voice-bridge2 | 2bde1283-e5bc-416d-936d-8fc116f2d4a9 | workspace:72 | **Channel** | voice-bridge2 team lead (relay name still "voice-bridge" — no relaunch, CEO-approved) | Active — bypassPermissions, cwd: ~/environment/projects/voice-bridge2 |
| knowledge-base | 3d844227-46b1-49e2-a872-8a3834beb639 | workspace:14 | **Channel** | Batch video analyzer — YouTube/web transcript → summarize → knowledge DB | Active — bypassPermissions, cwd: ~/environment/projects/knowledge-base |
| jarvis | — | workspace:12 | **Channel** | Voice communicator — routes CEO voice messages to correct agents (Haiku, lightweight) | Active — bypassPermissions, cwd: ~/environment/jarvis |
| satellite-team | — | workspace:15 | **Channel** | Dedicated satellite visibility team — sub-agent registration → relay → 3D display | Active — bypassPermissions, cwd: ~/environment/projects/satellite-visibility |
| ux-expert | — | workspace:8 | **Channel** | Consultant: CEO experience, dashboard UX, information architecture | Active — bypassPermissions, cwd: ~/environment |
| system-expert (matrix) | — | — | — | Merged into chief-of-staff — same agent, same session | **Retired — chief-of-staff owns system-expert scope** |

| chief-of-staff | d27b5433-2f32-4273-b783-aefee1654f37 | workspace:132 | **Channel** | Chief of Staff — cross-project coding manager. Owns code quality, standards, architecture (TypeScript/linting/vertical slice) across relay, productivitesse, knowledge-base and all future projects. | Active — bypassPermissions, sonnet, cwd: ~/environment |
| cline-kanban-expert | — | workspace:17 | **Channel** | Research: Cline Kanban deep study — task model, auto-activation, agent comm, gap list, implementation plan | Active — bypassPermissions, sonnet, output: ~/.research/cline-kanban/ |

## Non-Interactive Sessions (workspaces gone — UUIDs may be resumable)
| Session | UUID | Notes |
|---------|------|-------|
| cline-expert | — | Knowledge files ready at ~/environment/knowledge/cline-kanban/ — launch when Cline integration begins |
| meta:ai-gamedev-lead | 3942de54-54ee-4a98-916e-4ec5b10f7242 | Research complete — resume if needed |
| meta:productivity-helper-lead | 45b59c4f-c702-4b47-b16c-395bcf278d25 | Was workspace:9 — no longer running |

## Migration Status
Sessions need to be relaunched with channel plugin to get MCP push messaging.
Migrate as sessions go idle — don't disrupt active work.
New sessions MUST always use: `RELAY_AGENT_NAME={name} claude --name {name} --dangerously-load-development-channels plugin:relay-channel@relay-plugins --remote-control`

The `--name {name}` flag sets the session title in the Claude app Remote Control view. Without it, sessions show auto-generated conversation titles and CEO cannot identify them on mobile.
