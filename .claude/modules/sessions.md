# Session Management

## Session Naming Rule
Workspace name MUST exactly match the agent's messaging name.
- No prefixes, no long descriptions — just the short name (e.g., `command`, `consul`, `agency-bicycles`)
- Used in `relay_send(to: "...")` and `GET /messages/:agent`
- **Never rename an existing workspace** unless explicitly correcting a mistake — only name on creation
- **No duplicate workspaces:** Before opening a session, run `cmux list-workspaces` and close any existing workspace with the same name first: `cmux close-workspace --workspace <old>`. One session = one workspace, always.
- Create pattern (parse workspace ID from output carefully):
  ```bash
  WS=$(cmux new-workspace --cwd ... --command "..." 2>/dev/null | sed 's/OK //')
  cmux rename-workspace --workspace "$WS" "name"
  ```
  ⚠️ `cmux new-workspace` returns `OK workspace:N` — strip the `OK ` prefix before passing to rename, or rename will silently target the currently selected workspace instead

## Creating a Session

**Always use the launch script:**
```bash
scripts/spawn-session.sh <type> <name> [cwd] [model] [uuid]
```

The script handles everything: agent type loading, three names aligned (relay + session + workspace), channel plugin, remote-control, bypass permissions, and channel auto-approval.

**Examples:**
```bash
# New PM
scripts/spawn-session.sh project-manager atlas ~/environment haiku

# New team lead for a project
mkdir -p ~/environment/projects/{project}/.worklog
scripts/spawn-session.sh team-lead {name} ~/environment/projects/{project}

# New domain expert
scripts/spawn-session.sh system-expert matrix ~/environment sonnet
```

**Convenience wrappers:**
```bash
scripts/spawn-manager.sh <name> <uuid> [cwd] [model]
scripts/spawn-team-lead.sh <name> <uuid> <cwd>
```

**Never use raw `claude` commands** — the script ensures channel plugin, permissions, naming alignment, and auto-approval. Manual launches inevitably miss something.

**Never use `claude -p` for persistent sessions** — non-interactive sessions don't load the channel plugin and can't receive messages.

## TeamCreate Lifecycle Rule
**Teammates are never dismissed by the team lead mid-task. Their context is the team's memory.**

A designer who reviewed a component, a researcher who studied the codebase, a reviewer who knows why a decision was made — that knowledge is gone on shutdown and cannot be cheaply reconstructed. Dismissing a teammate to "clean up" trades a small resource saving for a large context loss.

**Shutdown is only valid when:**
1. The work is fully complete and merged to main (for coding tasks), OR
2. The CEO explicitly says to shut down the team or a specific member

**Not valid reasons to shut down:**
- Their immediate sub-task is done
- They seem idle
- The team lead wants a "fresh" team
- The session is getting long

If a teammate is idle, leave them alive. They cost nothing until the next message.

## Session Resume Protocol
Agent teams (TeamCreate) die when CLI session ends. On resume:
1. Team lead reads `.worklog/` to recover context
2. Team lead re-creates persistent team members (TeamCreate)
3. New agents read `.worklog/{agent-name}.md` for baseline
4. Worklogs are the insurance policy — they survive across sessions

## Agent Templates
See `.claude/agents/` for agent definitions:
- `team-lead.md` — instructions for coding project team leads
- `agency-lead.md` — instructions for agency/research project leads
- `command.md`, `consul.md` — meta-manager identities

When creating a project, read the relevant template and pass it as the initial prompt.
