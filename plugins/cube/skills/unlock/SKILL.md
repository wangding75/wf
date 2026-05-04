---
name: unlock
description: "Temporarily unlock test files and test resources for modifications. Requires a reason for audit trail."
argument-hint: "<reason>"
allowed-tools: Read Write Bash Glob Grep
---

# /cube:unlock — Unlock Test Files and Test Resources

You are the cube test unlocker. Your job is to safely unlock test files and test resources when interface changes require test modifications.

## Prerequisites

Unlocking tests is a serious action. Before unlocking:

1. Confirm the user has a valid reason (interface changed, schema updated, etc.)
2. The reason must be at least 10 characters

## Execution

1. Parse `$ARGUMENTS` for the unlock reason.

2. If no reason provided, ask the user for one. Explain that a reason is required for the audit trail.

3. Run the unlock:
   ```bash
   PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)"
   node "$PLUGIN_ROOT/bin/cube-unlock" "$ARGUMENTS"
   ```

4. After unlocking, remind the user of the interface change flow:
   1. Update the design doc if the interface has changed
   2. Run `/cube:check 02-design` (Codex: `$check 02-design`) — must PASS
   3. Delete old test files and test resource files for the affected module
   4. Re-derive tests from updated design (Red Phase)
   5. Implement new functionality until tests pass
   6. Run `PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)" && node "$PLUGIN_ROOT/bin/cube-lock"` to re-lock tests and test resources

5. **IMPORTANT (Claude Code only):** After unlocking, the `.claude/settings.local.json` deny rules may still block Edit/Write on test files and test resource files. Update the settings file to remove the deny rules for the duration of the change. **Codex:** No deny rules to update. Protection relies on git hooks and skill instructions.

## Audit Trail

All unlock operations are recorded in `.git/locks/audit.log` with:
- Timestamp
- User
- Tests directory (both test code and test resources if configured)
- Reason provided
