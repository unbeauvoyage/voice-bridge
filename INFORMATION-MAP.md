# Information Map

Where everything lives in the system. One page, always up to date.

## CEO Input Types → Where They Go

| CEO says... | Type | Routed to | Stored at | Dashboard section |
|---|---|---|---|---|
| "Build X" / "Fix Y" | **Directive** | Team lead | ISSUES.md or BACKLOG.md | Issues / Backlog panel |
| "Maybe we should..." | **Uncertainty** | Researcher agent | ~/environment/proposals/ | Proposals panel |
| "I wonder how X works" | **Learning question** | Researcher agent | ~/environment/answers/ | Questions panel |
| "My dream is..." | **Dream/Vision** | BACKLOG.md (Backlog section) | ~/environment/BACKLOG.md | Backlog panel |
| "Something's broken" | **Bug/Issue** | Team lead | ~/environment/ISSUES.md | Issues panel |

## Information Storage

| Type | Location | Format | Who writes | Who reads |
|---|---|---|---|---|
| **Issues** | `~/environment/ISSUES.md` | `- [ ] **[team]** description` | Command, agents | Dashboard, teams |
| **Backlog** | `~/environment/BACKLOG.md` | Kanban sections | Command (CEO approves Active) | Dashboard, Command |
| **Proposals** | `~/environment/proposals/*.md` | Markdown with status | Researcher agents | Dashboard, CEO |
| **Answers** | `~/environment/answers/*.md` | Question + concise answer | Team leads | Dashboard, CEO |
| **Reports** | `project/.worklog/*.md` | Free-form markdown | Agents | Dashboard, CEO |
| **Sessions** | `~/environment/SESSIONS.md` | Table | Command | Dashboard |
| **Morning briefing** | `~/environment/reports/*.md` | Structured summary | Command | CEO |

## Agent Communication

| Channel | Purpose | Tool |
|---|---|---|
| Relay messages | Agent ↔ agent, CEO ↔ agent | relay_send / relay_reply |
| WebSocket (ws://localhost:8765/ws) | Dashboard live updates | Auto-broadcast |
| .worklog/ files | Detailed work logs | File write |
| DONE messages | Completion signals | relay_send |

## Dashboard Panels (agents3d view)

| Panel | Data source | Interactive? |
|---|---|---|
| Agent hierarchy | Relay /status + hardcoded tree | Click planet → detail |
| Messages | Relay WebSocket feed | Click to expand, reply inline |
| Proposals | ~/environment/proposals/*.md | Click to expand, approve/reject |
| Reports | project/.worklog/*.md | Click to expand, read full |
| Issues | ~/environment/ISSUES.md | Click to expand, assign |
| Backlog | ~/environment/BACKLOG.md | Click to expand |
| Questions/Answers | ~/environment/answers/*.md | Click to read answer |
| Notifications | Relay events | Auto-appear, click to dismiss |

## What's NOT tracked yet (gaps)

- CEO "active" indicator (speaking/transcribing status) — needs design
- Agent current-task visibility in dashboard — proposed, not built
- Notification system — proposed, not built
- Questions/Answers panel in dashboard — folder exists, panel not built yet
