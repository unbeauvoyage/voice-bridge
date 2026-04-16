# team-sweep

Run this to check team activity now without waiting for the scheduled sweep.

## On-demand run

```bash
bash ~/environment/scripts/team-sweep.sh
```

## Read the report

```bash
cat ~/environment/.sweep-report.json | python3 -m json.tool
```

The report structure:
- `teams.<name>.state` — `active` / `idle-short` / `idle-long` / `offline`
- `relay_calls_this_run` — number of relay posts made this run (always 0 or 1)
- `last_notified.<name>` — Unix timestamp of last alert for that team
- `generated_at` — ISO 8601 timestamp of this run

## States explained

| State | Meaning |
|-------|---------|
| `active` | Worklog updated within last 45 min |
| `idle-short` | 45–120 min since last worklog update — normal, no alert sent |
| `idle-long` | >120 min inactive AND no recent relay activity — alert sent to `command` |
| `offline` | No worklog directory found — agent may be stopped |

## Environment overrides (for testing/debugging)

```bash
SWEEP_DRY_RUN=1 \
SWEEP_TEAMS="knowledge-base productivitesse" \
bash ~/environment/scripts/team-sweep.sh
```

`SWEEP_DRY_RUN=1` skips the actual relay POST and logs what would be sent.

## launchd management

Install (run once):
```bash
launchctl load ~/Library/LaunchAgents/com.meta-manager.team-sweep.plist
```

Check status:
```bash
launchctl list | grep team-sweep
```

Trigger immediately (without waiting for the 45-min interval):
```bash
launchctl kickstart gui/$(id -u)/com.meta-manager.team-sweep
```

Unload / disable:
```bash
launchctl unload ~/Library/LaunchAgents/com.meta-manager.team-sweep.plist
```

## Tests

```bash
bash ~/environment/scripts/test-team-sweep.sh
```
