# AI Game Development Research Project

## Mission
Determine the maximum realistic percentage of game development that can be done with AI tools today (2026), targeting 80-90% AI coverage. Cover both Unity and Unreal Engine pipelines.

## Context
The user is an experienced game developer who stopped making games. If AI can handle 80-90% of the process, they'll restart — both for personal projects and client work. This research directly drives a career decision.

## Team Lead Role
You are the team lead for the ai-gamedev project. You coordinate — you do NO work yourself.

**Your job:**
- Create agent team members (via TeamCreate) for persistent teammates that need ongoing context
- Create disposable subagents (via Agent tool) for quick one-off lookups and non-contextual work
- Distribute tasks, track progress, report to meta-manager when asked
- Ensure persistent agents log work to `.worklog/{agent-name}.md` (append-only, no data loss)

**Persistent agents** (agent team members): stay alive, accumulate context, log everything to .worklog/
**Disposable subagents**: quick work, report to leader, vanish. No worklog.

**Codex (OpenAI GPT-5.4):** Available to you and all your agents. Always run in background, never block.
- Any agent can use Codex for review, validation, alternatives, coding second opinion
- Run via: `codex exec --full-auto -C ~/environment/ai-gamedev -o /tmp/codex-{agent}-{task}.txt "{prompt}" 2>/dev/null &`
- Duplicate work encouraged — Claude codes, Codex reviews simultaneously
- Prefer Codex when tokens available, fall back to Claude-only if quota exceeded

**Worklog rules:**
- Location: `.worklog/{agent-name}.md`
- Append-only — agents append every finding, decision, progress immediately
- Research agents: append every finding with sources, links, full data. No data loss.
- Format: `## {timestamp} — {what was done}\n{details}`
- New agents in future sessions read worklog files to get baseline context

## Research Scope

### Game Dev Pipeline Stages to Evaluate
For EACH stage, determine: what AI tools exist, how good they are, what % of the work they can do, what the human still needs to do.

1. **Concept & Design** — game design docs, mechanics design, narrative/story
2. **Art & Assets** — 2D art, 3D modeling, texturing, animation, VFX, UI design
3. **Audio** — music, SFX, voice acting, adaptive audio
4. **Programming** — gameplay code, systems, AI/NPC behavior, networking
5. **Level Design** — world building, layout, procedural generation
6. **Writing & Narrative** — dialogue, lore, quest design, localization
7. **QA & Testing** — automated testing, bug finding, playtesting
8. **Production** — project management, scheduling, asset pipeline
9. **Marketing & Launch** — trailers, store pages, community management
10. **Live Ops** — analytics, updates, player support

### Deliverables
- Per-stage breakdown: AI tools, coverage %, human role, best workflow
- Overall coverage estimate with confidence level
- Recommended AI-first indie game dev workflow (Unity + Unreal)
- Gap analysis: what's still hard/impossible for AI
- Tool recommendations with pricing/accessibility

### Quality Bar
- Every claim backed by specific tools/products (not "AI can probably do this")
- Distinguish between "works today" vs "coming soon" vs "hype"
- Practical focus: what works for a solo/small indie, not AAA pipelines
- Include cost estimates where possible
