---
description: Run Codex CLI in full-auto mode on a coding task. Always runs in background. Use for parallel coding alongside Claude, or to hand off a self-contained task entirely.
argument-hint: "-C <project-dir> <task prompt>"
allowed-tools: Bash
---

Parse the arguments: `$ARGUMENTS`

Extract:
- `-C <dir>` → project directory (required)
- Everything after the directory → the task prompt

Then run this exact command:

```bash
OUTPUT=/tmp/codex-$(date +%s).txt
codex exec --full-auto --model gpt-5.3-codex-spark -C "$PROJECT_DIR" -o "$OUTPUT" "$TASK" 2>/dev/null &
echo "Codex job started. Output: $OUTPUT"
```

Report back: the output file path and confirm the job is running in the background. Tell the user to check output with `cat $OUTPUT` or `/codex:result`.
