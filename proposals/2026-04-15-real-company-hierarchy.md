---
title: Real Company Hierarchy — CEO Direction #3
timestamp: 2026-04-15T16:55:00
status: proposal
summary: Org chart with departments, reporting, escalation paths. Agents know their place in the structure.
---

# Real Company Hierarchy — Agent Org Chart

**Aligns with:** CEO Direction #3 (Real Company Hierarchy — Agents Know Their Place)

**Purpose:** Every agent should know who their manager is, who their peers are, and how to escalate.

## Proposed Structure

```
CEO
├── Command (Sonnet PM)
│   ├── Chief of Staff (Sonnet)
│   │   ├── system-expert (architecture, standards)
│   │   ├── security-expert (vulnerabilities, compliance)
│   │   ├── communications-expert (relay health, messaging)
│   │   ├── ux-expert (dashboard, CEO experience)
│   │   └── quality-auditor (cross-project quality)
│   │
│   └── Project Managers (Atlas, Sentinel, etc. — Sonnet)
│       ├── voice-bridge Team Lead → coders, testers, designers
│       ├── productivitesse Team Lead → coders, testers, designers
│       ├── knowledge-base Team Lead → coders, testers, designers
│       ├── relay Team Lead → coders, infra specialists
│       └── {future projects}
│
└── Agency Research Lead (Codex sessions — Opus research)
    └── 7 Agency Teams (housing, cars, bicycles, kabab, coffee, routers, business-ops)
        └── Codex research → findings → proposals
```

## Departments

### **Engineering Department**
- **Owner:** Chief of Staff (coding standards, architecture)
- **Teams:** voice-bridge, productivitesse, knowledge-base, relay
- **Responsibilities:** 
  - Feature development (TDD, code reviews, testing)
  - Infrastructure (relay hardening, Docker Compose, monitoring)
  - Cross-project standards (TypeScript, ESLint, folder structure)
- **Escalation:** Chief of Staff for architecture questions, security-expert for vulnerabilities

### **Research & Agency Department**
- **Owner:** Agency Research Lead (Opus researcher, persistent)
- **Teams:** 7 parallel agencies (housing, cars, bicycles, kabab, coffee, routers, business-ops)
- **Responsibilities:**
  - Customer research → business models → findings
  - Codex interactive research sessions (full context, Opus level)
  - Knowledge capture in .worklog/
- **Escalation:** Pitch findings to CEO for consultancy follow-up

### **UX & Experience Department**
- **Owner:** ux-expert (Sonnet)
- **Responsibilities:**
  - Dashboard design (information architecture, attention management)
  - CEO-facing features (how agents present to the CEO)
  - Mobile/web UX decisions
  - Design system maintenance
- **Escalation:** ux-expert for all CEO experience questions

### **Security & Compliance Department**
- **Owner:** security-expert (Sonnet)
- **Responsibilities:**
  - Permission enforcement (file/command boundaries)
  - Vulnerability scanning (prompt injection, exposed ports)
  - Secure communication (relay authentication, channel encryption)
  - Audit logging (who did what, when, why)
- **Escalation:** security-expert for any suspected breach or risky operation

### **Communications Department**
- **Owner:** communications-expert (Sonnet)
- **Responsibilities:**
  - Relay health monitoring (detect zombies, duplicates, queue buildup)
  - Message delivery reliability
  - Channel registration / keepalive
  - On-call for relay outages
- **Escalation:** communications-expert when relay is down or delivering late

### **Quality Department**
- **Owner:** quality-auditor (Sonnet)
- **Responsibilities:**
  - Cross-project quality audits (code, tests, specs, errors)
  - Standards enforcement (testing discipline, observability, specs)
  - Pattern generalization (find improvement in one project, replicate system-wide)
  - Missing-test detection (bugs that could have been caught by tests)
- **Escalation:** quality-auditor for quality concerns that affect multiple projects

---

## Reporting Lines

### Project Team Leads
- **Report to:** Command (project manager) for strategy and CEO assignments
- **Coordinate with:** Chief of Staff for cross-project standards
- **Can escalate to:** Chief of Staff for architectural decisions, security-expert for security questions

### Domain Experts (system-expert, security-expert, etc.)
- **Report to:** Chief of Staff (peers, not hierarchical)
- **Authority:** Advise all teams in their domain (final decision authority on architecture, security, etc.)
- **Direct access:** Any agent can ask them questions directly
- **Proactive:** Monitor their domain continuously, surface problems without being asked

### Codex Researchers (Agency Research Lead + agency teams)
- **Report to:** CEO for findings and consultancy opportunities
- **Persistent sessions:** Maintain context across iterations
- **Parallel work:** All 7 agencies run simultaneously (separate Codex sessions)
- **Knowledge base:** .worklog/ is source of truth for findings

### Coders, Testers, Designers
- **Report to:** Team lead (task assignments, code review, test results)
- **Escalate to:** Chief of Staff if architectural/standards question
- **Review:** Use Codex for /review and /rescue

---

## Request Routing

### Code/Feature Questions
```
Coder/Team Lead → Chief of Staff (standards) or system-expert (architecture)
```

### Bug/Quality Issues
```
Team Lead → quality-auditor (cross-project pattern) or Chief of Staff (local fix)
```

### Security Concerns
```
Anyone → security-expert (direct, no hierarchy)
```

### Relay/Communication Problems
```
Anyone → communications-expert (direct, no hierarchy)
```

### UX/Dashboard Questions
```
Team Lead → ux-expert (design), CEO → ux-expert (experience priorities)
```

### Strategic/Roadmap Decisions
```
Team Lead → Command or CEO (not Chief of Staff — architecture only)
```

### Permission/Compliance Questions
```
Anyone → security-expert (direct)
```

---

## Agent Identity Fields

Every agent definition should include:

```yaml
name: {role-name}
department: {engineering|research|ux|security|communications|quality}
reports_to: {immediate-manager}
escalates_to: [list of escalation contacts]
```

### Example: voice-bridge coder

```yaml
name: voice-bridge-coder
type: coder
department: engineering
reports_to: voice-bridge-team-lead
escalates_to: [chief-of-staff, security-expert]
authority: code implementation in voice-bridge/ only
can_request: code reviews from chief-of-staff, architecture advice from system-expert
```

### Example: Chief of Staff

```yaml
name: chief-of-staff
type: domain-expert
department: engineering
reports_to: CEO
escalates_to: [CEO]
authority: coding standards, architecture, cross-project decisions
can_manage: all engineering teams, domain experts are peers
```

---

## Peer Relationships

These are **peers**, not hierarchical:
- Chief of Staff ↔ system-expert, security-expert, ux-expert, communications-expert, quality-auditor
- Command ↔ Agency Lead (separate concerns: projects vs research)
- Team Leads ↔ Domain Experts (team leads request advice, experts provide it)

Peers coordinate via relay messages (SendMessage with "type: message" for discussion).

---

## Authority Boundaries

**Chief of Staff** decides:
- Code standards (TDD, linting, folder structure)
- Architecture patterns (data flow, component design)
- Cross-project consistency

**Chief of Staff does NOT decide:**
- Which features to build (CEO decides)
- When to ship (CEO decides)
- Project roadmap (Command decides)

**Team Lead** decides:
- Work allocation within their team
- Which agents work on which tasks
- Branch management and merges

**Team Lead does NOT decide:**
- Code standards (Chief of Staff sets these)
- Architecture (escalate to Chief of Staff)
- Security (escalate to security-expert)

**security-expert** decides:
- What's a security risk
- Whether a permission can be granted
- What audit/compliance rules apply

**ux-expert** decides:
- How CEO experiences the system
- Dashboard information architecture
- Design system rules

---

## Communication Norms

1. **Direct escalation:** Anyone can message a domain expert directly (no manager required)
2. **Async reporting:** Use relay messages; don't block on response
3. **Decision clarity:** Chief of Staff publishes decisions in CLAUDE.md, not via chat
4. **Proposal workflow:** Researchers write proposals → CEO approves → teams execute
5. **Conflict resolution:** If two domains conflict (code quality vs schedule), CEO decides

---

## Implementation

1. **Update `.claude/agents/{role}.md`:** Add `department`, `reports_to`, `escalates_to` fields
2. **Create `.claude/hierarchy.md`:** Org chart + department responsibilities
3. **Update CLAUDE.md:** Document reporting lines and escalation paths
4. **Train agents:** New agents read hierarchy.md on startup (add to onboarding checklist)

---

**Chief of Staff**  
2026-04-15T16:55:00
