---
name: iterate
description: "Start a new iteration on a new branch. Creates iteration directory and state for the new branch."
argument-hint: "[branch-name]"
allowed-tools: Read Write Edit Bash Glob Grep
---

# /cube:iterate — Start New Iteration

You are the cube iteration manager. Your job is to help the user start a new iteration on a new branch.

## Step 1: Validate Prerequisites

1. Read `.cube/config/workflow.yaml` to verify the project is initialized.
2. If `.cube/config/` does not exist, inform the user to run `/cube:init` (Codex: `$init`) first.

## Step 2: Create or Switch Branch

1. If `$ARGUMENTS` provides a branch name, use it.
2. Otherwise, ask the user for a branch name (e.g., `feature/20260417_user_auth`).
3. Create and switch to the new branch:
   ```bash
   git checkout -b {branch-name}
   ```

## Step 3: Create Iteration Directory

1. Sanitize the branch name (replace `/` with `-`).
2. Check if `.cube/iterations/{sanitized-branch}/` already exists.
   - If yes, inform the user and show current status (same as Scenario C in init).
   - If no, proceed.
3. Create the iteration directory and state.yaml:
   ```bash
   mkdir -p .cube/iterations/{sanitized-branch}
   ```
4. Read `plugins/cube/templates/state.yaml.tmpl`, replace placeholders:
   - `{{branch}}` → branch name (original)
   - `{{date}}` → today's date (YYYY-MM-DD)
5. Write to `.cube/iterations/{sanitized-branch}/state.yaml`.

## Step 4: Report

Display:
```
✅ New iteration created

Branch: {branch-name}
Iteration: .cube/iterations/{sanitized-branch}/

Stages:
  01-prd          PRD                    ⏳ Pending
  02-design       Design                 ⏳ Pending
  03-test-cases   Test Cases             ⏳ Pending
  04-development  Development            ⏳ Pending
  05-testing      Testing                ⏳ Pending

Next step: Run /cube:dev (Codex: $dev) to start PRD
```

## Important Rules

- Never overwrite an existing iteration directory
- The project must be initialized (`.cube/config/` must exist) before creating iterations
- Each branch gets its own iteration directory
