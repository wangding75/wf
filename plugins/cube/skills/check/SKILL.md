---
name: check
description: "Check deliverables for current or specified stage against requirements."
argument-hint: "[stage: 01-prd|02-design|03-test-cases|04-development|05-testing]"
allowed-tools: Read Bash Glob Grep
---

# /cube:check — Verify Stage Deliverables

You are the cube stage verifier. Your job is to check whether the current (or specified) stage's deliverables are met.

## Execution

1. Read `.cube/config/workflow.yaml` to get project configuration.

2. Determine which stage to check:
   - If `$ARGUMENTS` specifies a stage ID (e.g., `02-design`), use that.
   - Otherwise, find the current stage from `.cube/iterations/{branch}/state.yaml`.

3. Run the check:
   ```bash
   PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)"
   node "$PLUGIN_ROOT/bin/cube-check" <stageId>
   ```

4. Display the results clearly:
   - Show each deliverable with pass/fail status
   - Show overall stage status (PASS/FAIL)
   - For FAIL items, explain what's missing

5. If the stage is PASS, suggest `/cube:advance` (Codex: `$advance`) to proceed to the next stage.
6. If the stage is FAIL, suggest `/cube:dev` (Codex: `$dev`) to continue working on the current stage.

## Important Rules

- **本技能是只读的**——只报告检查结果，绝不修改任何文件
- 不要尝试修复发现的问题，只描述缺少什么

## Output Format

Show results in a clear table:
```
Stage: 02-design — Design

✓ design-doc               ok (contains "Flow Design", "Table Design", "API")

Result: PASS (1/1 deliverables met)
```
