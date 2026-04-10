---
title: Proposal Filename Convention Cleanup
date: 2026-04-04
status: pending
author: system-lead
---

# Proposal Filename Convention Cleanup

**Date:** 2026-04-04T08:15:12
**Author:** system-lead
**Confirmed with:** ux-lead (during parallel audits)

---

## Problem

6 proposal files do not follow the required `YYYY-MM-DD-slug.md` naming convention. This matters because:
- The dashboard derives proposal IDs from filenames — non-conforming names produce unsortable IDs
- "Read full spec" file links use the filename-derived ID path — incorrect names break these links
- Proposals don't sort chronologically in the dashboard

## Non-Conforming Files

| File | Status | Risk Level |
|------|--------|------------|
| `emoji-taxonomy.md` | **pending** | HIGH — live proposal, rename requires re-POST to /proposals |
| `ceo-knowledge-board.md` | approved | Low — already resolved, rename safe |
| `doc-drawer.md` | approved | Low — already resolved, rename safe |
| `layout-message-deduplication.md` | approved | Low — already resolved, rename safe |
| `my-requests-board.md` | approved | Low — already resolved, rename safe |
| `productivitesse-design-team-system.md` | approved | Low — already resolved, rename safe |

## Proposed Action

**Approved files (5 files):** Rename directly — dashboard shows these in history section, old IDs are no longer active. No re-POST needed.

Suggested names:
- `ceo-knowledge-board.md` → `2026-04-04-ceo-knowledge-board.md`
- `doc-drawer.md` → `2026-04-04-doc-drawer.md`
- `layout-message-deduplication.md` → `2026-04-04-layout-message-deduplication.md`
- `my-requests-board.md` → `2026-04-04-my-requests-board.md`
- `productivitesse-design-team-system.md` → `2026-04-03-productivitesse-design-team-system.md`

**Pending file (1 file — emoji-taxonomy.md):** Requires safe rename sequence:
1. Rename `emoji-taxonomy.md` → `2026-04-03-emoji-taxonomy.md`
2. Re-POST to `POST /proposals` with new ID
3. Old ID `emoji-taxonomy` becomes orphan — verify dashboard no longer references it

## Going Forward

System-lead will enforce the `YYYY-MM-DD-slug.md` convention for all new proposals. Added to CONCEPTS.md proposal format rules.

## Assign To
consul or command — a few `mv` commands + one relay POST. Low risk, 10-minute task.
