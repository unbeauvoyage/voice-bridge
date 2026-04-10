# Questions

CEO questions — detected automatically by the distiller hook or created manually by agents.
Each file = one question. See `~/environment/FORMATS.md` for the canonical schema.

## Format

```markdown
---
type: question
title: Short question (shown on Knowledge Board card)
status: open | researching | answered
asked: 2026-04-06T12:00:00
asked-by: ceo
triggered-by: manual | distiller
answer: ~/environment/answers/YYYY-MM-DD-slug.md  (fill in when answered)
---

Full question text and any context the CEO provided.
```

## Workflow

1. CEO expresses curiosity ("I wonder...", "I'm curious...", "I have a question") in any session
2. `distill-ceo-message.sh` hook fires → creates question file here automatically
   — OR — agent detects signal manually and creates the file
3. File created → hook relays `[Q&A SIGNAL]` task to command
4. Command spawns `researcher` to investigate
5. Researcher writes answer to `~/environment/answers/YYYY-MM-DD-slug.md`
6. Question file updated: `status: answered` + `answer:` field linked
7. Dashboard Knowledge Board shows both questions and answers
