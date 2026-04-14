---
title: Proposal + Q&A Workflow Design
date: 2026-04-03
status: proposed
---

# Proposal: Proposal + Q&A Workflow Design

**Status:** Draft — needs CEO approval
**Author:** Command
**Date:** 2026-04-03

## 1. Proposal → Agent Workflow

### What happens when CEO approves a proposal?

**Approve flow:**
1. CEO taps Approve → relay marks `status: approved`
2. Relay broadcasts to ALL team leads: `[TASK APPROVED] [title] — proposedBy [agent]`
3. The proposing agent gets confirmation: "CEO approved your proposal: [title]"
4. Command gets notified to assign work if no specific agent owns it
5. Dashboard: card moves to "Approved" section with green indicator

**Reject flow:**
1. CEO taps Reject → optional reason text (inline textarea)
2. Proposing agent gets: "[REJECTED] [title] — CEO reason: [text]"
3. Card grays out and moves to bottom

**"Do this" flow:**
1. CEO taps "Do this" → mic activates
2. CEO speaks custom instructions about THIS proposal
3. Transcript sent directly to proposing agent: "[CEO INSTRUCTION] Re: [title] — [transcript]"
4. This IS the approval — no separate Approve needed when using "Do this"
5. Card shows "CEO provided instructions" status

**Where CEO sees what happened:**
- Inbox tab shows the outbound "Do this" message
- Proposal card shows status badge (Approved / Rejected / Instructions sent)
- If agent follows up, it appears in Inbox too

---

## 2. Q&A Workflow

### Design: Questions as persistent tracked items

**Structure:**
```
Question card:
  Title: "How does X work?"
  Asked: [date]
  Status: answered ← green dot if unread
  Answer preview: first 80 chars...
  [Read Answer] [Ask Follow-up]
```

**Unread tracking:**
- Questions panel marks each answer as "unread" until CEO taps "Read Answer"
- Stored in localStorage (per device) or relay (cross-device)
- Count badge on Q&A tab showing unread answers

**Follow-up questions:**
1. CEO taps "Ask Follow-up" on any answered question
2. Mic activates (or text input)
3. Message sent to the researcher who wrote the answer: "Follow-up on [title]: [text]"
4. New question file created linked to the parent
5. Status resets to "pending"

**User journey:**
```
CEO sees notification: "New answer: How does X work?"
  → Taps Q&A tab
  → Sees answer card with unread dot
  → Taps "Read Answer" → full answer expands
  → Taps "Ask Follow-up" → records voice question
  → Agent gets: "Follow-up on [title]: [voice transcript]"
  → Answer card updates with follow-up thread
```

---

## 3. Scale: File System → Database

**When to migrate:**
- File system is fine up to ~1000 files per folder
- Currently: 19 proposals, 3 answers, 3 questions — no problem
- Trigger point: if any folder exceeds 200 files, or if search/filter becomes slow

**When we migrate, use SQLite (local):**
- Single file: `~/environment/data.db`
- Tables: messages, proposals, questions, answers
- Relay switches from reading files to querying SQLite
- Migration: one-time script converts existing files to DB rows

**Not needed now** — file system is fine for current scale. Track if proposals/answers grow past 100.

---

## Summary: Expected User Journey

**Using proposals:**
```
Agent does research → writes proposal file → relay ingests
CEO opens dashboard → Proposals tab → 18 cards
CEO taps "Do this" on one → speaks "Build this next week with productivitesse"
Agent gets message → starts working
CEO sees card = "Instructions sent"
CEO checks Inbox tab → sees their outbound message + any agent reply
```

**Using Q&A:**
```
CEO asks "I'm wondering how X works"
Jarvis detects uncertainty → Command spawns researcher
Researcher writes ~/environment/answers/X.md
Dashboard Q&A tab shows unread dot
CEO taps → reads answer → satisfied or taps "Ask Follow-up"
Full thread tracked in Q&A panel
```
