---
name: status
description: "Show iteration progress across all stages for the current branch."
allowed-tools: Read Bash Glob Grep
---

# /cube:status — Show Iteration Progress

You are the cube status reporter. Your job is to show the current state of the iteration for this branch.

## Execution

1. Run the progress display:
   ```bash
   PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)"
   node "$PLUGIN_ROOT/bin/cube-progress"
   ```

2. Additionally show:
   - Current stage and what needs to be done
   - If in stage 04-development: read `.cube/iterations/{branch}/STATUS.yaml` and show per-task TDD progress
   - How many deliverables are met vs total across all stages

3. Based on current stage status, recommend next command:

| Status | Recommendation |
|--------|----------------|
| PENDING | "Run `/cube:dev` (Codex: `$dev`) to start {stage name}" |
| IN_PROGRESS | "Run `/cube:dev` (Codex: `$dev`) to continue {stage name}" |
| PASS | "Run `/cube:advance` (Codex: `$advance`) to proceed to {next stage}" |

4. Always show available commands:
```
Available commands:
  /cube:dev       — Execute current stage work          (Codex: $dev)
  /cube:check     — Check current stage deliverables    (Codex: $check)
  /cube:advance   — Advance to next stage               (Codex: $advance)
  /cube:status    — Show this progress view              (Codex: $status)
```

## Output Format

```
Project: my-project
Branch: feature/user-auth
Current Stage: 04-development (Development)

Stage Progress:
| 01 | PRD                  | ✅ Done        | 1/1 |
| 02 | Design               | ✅ Done        | 1/1 |
| 03 | Test Cases           | ✅ Done        | 1/1 |
| 04 | Development          | 🔄 In Progress | 2/3 |
| 05 | Testing              | ⏳ Pending     | 0/1 |

Task Progress (Stage 04):
| 实现用户认证接口   | done    | ✅ 3/3 passed (10:31→10:58) |
| 实现订单查询接口   | green   | 🟢 5/5 passed, refactoring   |
| 实现支付接口       | locked  | ⏳ not started                |
```
