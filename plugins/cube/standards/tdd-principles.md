# TDD Principles

> Test-Driven Development is a **mechanically enforced** workflow, not a guideline.

## Core Principle

**Tests are contracts.** Tests are derived from schema definitions. Once written, they are mechanically locked. Implementation must adapt to tests — never the reverse.

## Three-Layer Protection

Test immutability is enforced by three independent layers. Any single layer can block unauthorized modification:

| Layer | Mechanism | Effect |
|-------|-----------|--------|
| 1 | `.claude/settings.local.json` deny rules | Claude Code's Edit/Write tools reject test file and test resource paths |
| 2 | `.githooks/pre-commit` hook | Detects staged test files and test resources, blocks `git commit` |
| 3 | OS file permissions (chmod 444 / attrib +R) | Any process writing gets permission denied |

**Locked scope:** test code directory (`${paths.test_dir}`) AND test resource directory (`${paths.test_resource_dir}`). Test resources (SQL expectations, fixtures, JSON snapshots, etc.) are part of the test contract — modifying them is equivalent to modifying test assertions.

Advancing to stage 04 automatically triggers `cube-lock`, setting all three layers for both directories.

Unlocking requires `cube-unlock <reason>` (reason >= 10 characters), which leaves an audit trail in `.git/locks/audit.log`.

## TDD Cycle

### Phase 1: Red — Write Tests from Design

For each Development Task defined in the design document:

1. Create test file(s) in `${paths.test_dir}`
2. Reference the design document for expected behavior, Output Contract, SQL Contract, and type-specific testing standards
3. Cover:
   - Valid values, boundary values, invalid values for each field
   - Every declared error code
   - Happy Path, Error Path, Edge Cases
   - Feature-level integration when multiple components form one behavior
   - Type-specific behavior required by `standards/testing/`
4. For SQL/query output, derive expected SQL only from the design document and cover structure, syntax, and semantics
5. Run tests → **all must FAIL** (no implementation yet)
6. Commit: `test(<scope>): add TDD test cases`

### Phase 2: Lock — Freeze Tests

```bash
cube-lock
```

After this point, test files and test resource files (expectations, fixtures, etc.) are read-only contracts.

### Phase 3: Green — Implement to Pass

1. Write implementation code (only in `src/` or implementation directories)
2. **Never modify test files or test resource files** — adapt implementation to match tests
3. Run tests → all PASS
4. Refactor → keep all tests passing
5. Commit: `feat(<scope>): implement to pass TDD tests`

### Phase 4: Non-Functional Tests

Each task may require additional test files covering:

| Test Type | Purpose |
|-----------|---------|
| Logging tests | Assert required log fields (trace_id, business fields, duration) |
| Metrics tests | Assert monitoring metrics are registered and exposed |
| Fallback tests | Mock upstream failures, verify degradation behavior |
| Performance tests | Verify P99 latency meets SLO contract |

Requirements are defined in the design document.

### Phase 5: Coverage Verification

Run `cube-check-coverage` to verify:
- Every schema model is referenced in at least one test
- Every error code is referenced in at least one test

## Interface Change Flow

If interfaces must change after tests are locked:

1. Update the design doc in `.cube/iterations/{branch}/design.md`
2. Run `cube-check 02-design` — must PASS
3. Run `cube-unlock "interface change: <detailed reason>"`
4. Delete old test files and test resource files for the affected task
5. Re-derive tests from new schema (back to Red Phase)
6. Implement new functionality until tests pass
7. Run `cube-lock`

The audit log preserves all unlock history for review.

## Test Quality Standards

- Each test function tests exactly one thing
- Test names describe the scenario: `testFetchDailyRaisesInvalidSymbolWhenMalformed`
- Mock external I/O (network, database) but **never mock data content**
- Coverage targets: 80%+ line coverage minimum, 95%+ for critical paths
- Output contracts must have direct tests; a method that outputs SQL, JSON, files, messages, or CLI output needs tests for that output type
- Type-specific standards under `standards/testing/` are part of the test contract and are independent of implementation language
