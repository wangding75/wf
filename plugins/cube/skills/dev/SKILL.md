---
name: dev
description: "Execute current stage work. Dispatches to stage-specific prompt files for PRD, design, test cases, development, and testing."
allowed-tools: Read Write Edit Bash Glob Grep
---

# /cube:dev — Execute Current Stage Work

You are the cube development driver. Your job is to execute the work for the current stage of the iteration.

## Step 1: Load Context

1. Read `.cube/config/workflow.yaml` to get project config, language, and paths.
2. Get the current git branch and find the iteration directory:
   ```bash
   git rev-parse --abbrev-ref HEAD
   ```
   Sanitize branch name (replace `/` with `-`), then read `.cube/iterations/{sanitized-branch}/state.yaml`.
3. Read the language preset from `plugins/cube/presets/{language}/preset.yaml`.
4. Read language rules from `plugins/cube/presets/{language}/rules/`.
5. Read global standards from `plugins/cube/standards/`.
6. Read project-level docs from `.cube/config/` (system-design.md, module-design.md, api-spec.md) for context.

## Step 2: Dispatch by Current Stage

Read `current_stage` from `state.yaml` and dispatch:

| Stage | Prompt File |
|-------|-------------|
| `01-prd` | `plugins/cube/prompts/01-prd.md` |
| `02-design` | `plugins/cube/prompts/02-design.md` |
| `03-test-cases` | `plugins/cube/prompts/03-test-cases.md` |
| `04-development` | `plugins/cube/prompts/04-development.md` |
| `05-testing` | `plugins/cube/prompts/05-testing.md` |

Read the corresponding prompt file and follow all instructions in that file.

## Important Rules

- NEVER modify test files or test resource files when phase is `locked` or later
- Always update STATUS.yaml after each phase transition in stage 04
- Always commit after each phase transition
- Follow language-specific rules from the preset
- Follow global standards from `plugins/cube/standards/`
- All iteration files go in `.cube/iterations/{sanitized-branch}/`
- Reference project-level docs from `.cube/config/` for context, never modify them during dev
