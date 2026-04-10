---
title: "Do This" Voice Action on Proposals
date: 2026-04-03
status: approved
---
# Proposal: "Do This" Voice Action on Proposals

**Status:** approved
**Author:** Command
**Date:** 2026-04-03

## Feature
Add a "Do this" button to each proposal card in the dashboard. Pressing it activates voice recording so CEO can give verbal instructions about that proposal.

## Design Options

### Option 3 (Recommended): Save + Send

When CEO presses "Do this" and records a voice message:

1. **Transcribe** via Whisper (already running on pm2)
2. **Save** the transcript as a proposal annotation in the proposal file (appended as `## CEO Instructions` section)
3. **Route** the transcript + proposal context to the relevant team via relay
4. **Update proposal status** from "pending" → "approved with instructions"
5. **Dashboard shows** the annotation inline on the proposal card

### Why Option 3
- CEO can review what they said later (saved)
- Teams get immediate actionable instructions (sent)
- Proposal becomes self-contained: original proposal + CEO's voice response + status
- Matches existing pattern: proposals are files, annotations are sections in those files

### Data Flow
```
CEO taps "Do this" on proposal card
  → Browser mic activates (MediaRecorder API)
  → CEO speaks instructions
  → Audio sent to voice-bridge /transcribe endpoint
  → Transcript returned
  → POST /proposals/{id}/annotate with transcript
  → Relay broadcasts to relevant team
  → Proposal file updated with ## CEO Instructions
  → Dashboard card shows green "Approved" + instruction preview
```

### Dependencies
- voice-bridge /transcribe endpoint (exists)
- Relay proposal annotation endpoint (new)
- Dashboard mic permissions (new — browser will prompt)
- Proposal file format update (add instructions section)

### Implementation
This touches: dashboard (UI + mic), relay (annotation endpoint), voice-bridge (already has transcribe). Medium complexity — good candidate for a feature team.
