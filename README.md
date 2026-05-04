# CUBE - Stage-Gate Development Workflow

Enforced stage-gate development workflow plugin for Claude Code and Codex. Drives AI to independently complete production-grade development from requirements to deployment.

## Install

### Claude Code

```bash
/plugin marketplace add wangding75/wf
```

### Codex

In Codex, run:
```
Fetch and follow instructions from https://raw.githubusercontent.com/wangding75/wf/refs/heads/main/.codex/INSTALL.md
```

## Features

- **5-Stage Gate Workflow**: PRD → Design → Test Cases (Red) → Development (Green) → Testing
- **Enforced Quality Gates**: Per-stage deliverables machine verification — stages cannot advance until all deliverables pass
- **TDD Three-Layer Protection**: Claude Code deny rules + git pre-commit hook + OS file permissions
- **Branch-Based Iterations**: Each branch = one PRD = one complete iteration cycle, state tracked in `.cube/iterations/{branch}/`
- **Automated Progress Tracking**: STATUS.yaml (module-level TDD progress), state.yaml (stage progression)
- **Language Presets**: Java (JUnit5/Gradle/Maven) built-in, extensible to other languages

## Commands

| Command | Description |
|---------|-------------|
| `/cube:init [language]` | Initialize workflow (new project) or activate (existing project) |
| `/cube:dev` | Execute current stage work (PRD, design, TDD, testing) |
| `/cube:check [stage]` | Verify current/specified stage deliverables |
| `/cube:advance` | Advance to next stage (requires current stage PASS) |
| `/cube:status` | Show iteration progress across all stages |
| `/cube:unlock <reason>` | Temporarily unlock test directory for modifications |
| `/cube:iterate [branch]` | Start new iteration on a new branch |

## Quick Start

```bash
# New project
mkdir my-project && cd my-project && git init
# In Claude Code:
/cube:init java

# Clone existing cube project
git clone <repo> && cd <repo>
# In Claude Code:
/cube:init
/cube:dev
```

## Composition with ECC

CUBE is complementary to [everything-claude-code](https://github.com/affaan-m/everything-claude-code):

- **ECC** provides coding guidance (advisory) — best practices, code review, verification checklists
- **CUBE** provides workflow execution (enforced) — stage gates, test locking, progress tracking

Install both for maximum coverage:
```bash
/plugin marketplace add affaan-m/everything-claude-code
/plugin marketplace add wangding75/wf
```

## Language Presets

### Java (built-in)
- Build: Gradle / Maven (auto-detected)
- Test: JUnit 5 + AssertJ + Mockito
- Lint: Checkstyle (Google style)
- Coverage: JaCoCo (80%+ target)
- Coding rules: Based on [ECC Java rules](https://github.com/affaan-m/everything-claude-code/tree/main/rules/java)

## License

MIT
