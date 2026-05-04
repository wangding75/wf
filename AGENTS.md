# Repository Guidelines

## Project Structure & Module Organization

This repository packages the CUBE stage-gate workflow as Claude Code and Codex plugins. Core plugin content lives in `plugins/cube/`. Command entrypoints are shell wrappers in `plugins/cube/bin/`, while implementation scripts are dependency-free Node ESM modules in `plugins/cube/engine/`. Agent-facing skills live in `plugins/cube/skills/*/SKILL.md`; stage prompts are in `plugins/cube/prompts/`; reusable workflow files are in `plugins/cube/templates/`; project standards are in `plugins/cube/standards/`. Java-specific presets, rules, and deliverable schemas are under `plugins/cube/presets/java/`. Root docs and installation metadata live in `README.md`, `docs/`, `.claude-plugin/`, `.codex/`, and `.agents/`.

## Build, Test, and Development Commands

- `npm install --prefix plugins/cube`: runs `postinstall` and makes `plugins/cube/bin/*` executable.
- `node plugins/cube/engine/check-stage.mjs <stage>`: validates deliverables for a stage when run inside a CUBE-enabled target project.
- `node plugins/cube/engine/check-status.mjs`: checks iteration status files in a target project.
- `node plugins/cube/engine/check-schema-coverage.mjs plugins/cube/presets/java`: validates preset schema coverage.
- `plugins/cube/bin/cube-check <stage>`: smoke-tests the command wrapper; set `CLAUDE_SKILL_DIR=plugins/cube/skills/check` if testing outside an installed plugin context.

There is no bundled test runner yet; prefer focused smoke tests of touched engine scripts and wrappers.

## Coding Style & Naming Conventions

Use Node.js 18+ and ESM (`.mjs`, `"type": "module"`). Keep engine scripts dependency-free unless there is a strong reason to add a package. Use two-space indentation for JavaScript, JSON, and YAML. Name command wrappers `cube-<verb>`, engine files `<verb>-<noun>.mjs`, and skill directories by command name. Keep Markdown prompts and standards instructional, concise, and action-oriented.

## Testing Guidelines

When changing validation logic, create or reuse a small fixture target project and run the affected `engine/*.mjs` script directly. Verify both success and failure paths for stage checks, test locks, and schema coverage. For prompt or standards changes, run the corresponding `/cube:*` flow manually enough to confirm paths, filenames, and instructions still match the engine.

## Commit & Pull Request Guidelines

History uses short imperative messages, often Conventional Commit style such as `fix(cube): ...` or `feat(cube): ...`; prefer that form over vague `fix`. PRs should describe the workflow behavior changed, list commands run, link related issues, and include screenshots or terminal excerpts when command output or user-facing instructions change.

## Agent-Specific Instructions

Keep changes narrow. Do not rewrite generated iteration state, lock files, or unrelated plugin metadata unless the task requires it. Preserve executable permissions for files in `plugins/cube/bin/`.
