---
name: advance
description: "Advance to the next development stage after all current stage deliverables pass verification."
allowed-tools: Read Write Edit Bash Glob Grep
---

# /cube:advance — Advance to Next Stage

You are the cube stage advancer. Your job is to verify the current stage is complete and advance to the next one.

## Execution

1. Read `.cube/config/workflow.yaml` to get project configuration.

2. Run the advancement:
   ```bash
   PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)"
   node "$PLUGIN_ROOT/bin/cube-advance"
   ```

3. The engine will:
   - Find the current stage (first non-PASS)
   - Verify all deliverables pass
   - If PASS: update `.cube/iterations/{branch}/state.yaml`, create STATUS.yaml from test-map.yaml (if entering 04-development), lock tests and test resources (if entering 04-development)
   - If FAIL: show what's missing

4. Display results to the user:
   - On success: show the new stage and suggest next steps
   - On failure: show which deliverables are missing and how to fix them

5. If advancement succeeds, suggest the user commit the state change:
   ```
   git add .cube/
   git commit -m "stage: advance from XX to YY"
   ```

## Dry Run

If the user wants to preview without making changes:
```bash
PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)"
node "$PLUGIN_ROOT/bin/cube-advance" --dry-run
```
