---
name: regress
description: "Regress to an earlier development stage (e.g., from 04-development back to 02-design)."
argument-hint: "<target-stage: 01-prd|02-design|03-test-cases|04-development>"
allowed-tools: Read Bash Glob Grep
---

# /cube:regress — Regress to Earlier Stage

You are the cube stage regresser. Your job is to safely move the iteration back to an earlier stage.

## Execution

1. Read `.cube/config/workflow.yaml` to get project configuration.

2. Determine the target stage:
   - If `$ARGUMENTS` specifies a stage ID (e.g., `02-design`), use that.
   - Otherwise, ask the user which stage to regress to.

3. Run the regress command:
   ```bash
   PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)"
   node "$PLUGIN_ROOT/bin/cube-regress" <targetStageId>
   ```

4. Display the results clearly:
   - Show current stage and target stage
   - Show whether tests were auto-unlocked
   - Confirm no files were deleted

5. After successful regress, suggest next steps:
   - Run `/cube:dev` (Codex: `$dev`) to continue working in the target stage
   - The stage prompt will detect existing files and continue from where it left off

## Dry Run

If the user wants to preview without making changes:
```bash
PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)"
node "$PLUGIN_ROOT/bin/cube-regress" <targetStageId> --dry-run
```

## Important Notes

- Files are **never deleted** during regress — existing deliverables are preserved
- If regressing from 04-development or later, test files and test resource files are auto-unlocked
- The target stage prompt will read existing files and identify missing sections
- After regress, run `/cube:check` (Codex: `$check`) to see what's missing, then `/cube:dev` (Codex: `$dev`) to continue
