# Git Workflow

> Branching strategy and commit conventions for stage-gate development.

## Branch Strategy

Each git branch corresponds to one PRD and one complete iteration workflow cycle.

```
main              # Production branch — only accepts PR merges, no direct push
feature/xxx       # Feature development branch (from main)
fix/xxx           # Bug fix branch
```

## Commit Message Convention (Conventional Commits)

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `test` | Add or modify tests |
| `docs` | Documentation changes |
| `refactor` | Refactoring (no behavior change) |
| `chore` | Build/tooling/dependency changes |
| `stage` | Stage advancement |

### Examples

```
feat(data): add daily OHLCV writer for ClickHouse

test(factor): add unit tests for momentum factor calculation

stage: advance from 02-design to 03-test-cases
```

## Commit Principles

- Each commit does exactly one thing (atomic commits)
- Commit immediately after writing tests (Red commit)
- Commit again after implementation passes (Green commit)
- Never commit failing tests to main
- Add `.env`, secrets, credentials, and large data files to `.gitignore`

## Stage Advancement Commit

Create a dedicated commit when advancing to a new stage:

```bash
git add .cube/
git commit -m "stage: advance from 02-design to 03-test-cases"
```

## TDD Commit Sequence

Stage 03-test-cases (Red Phase):
```
test(<scope>): add TDD test cases        # Red Phase
```

Stage 04-development (Green Phase):
```
feat(<scope>): implement to pass tests    # Green Phase
test(<scope>): finalize tests             # Finalize Phase
```
