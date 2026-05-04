# Integration Testing Standard

> Language-neutral rules for feature-level integration tests.

## When Required

Write integration tests when a feature crosses component boundaries, such as:

- Parser -> Semantic -> Handler
- Controller -> Service -> Repository
- Consumer -> Validator -> Processor -> Publisher
- DSL -> Planner -> SQL Generator

Unit tests for each component do not replace this requirement.

## Required Coverage

- Drive the test through the earliest practical entry point for the feature.
- Use real data structures passed between components; do not mock the data contract between components under test.
- Assert the final business result and at least one important intermediate contract when the chain transforms data.
- Cover happy path, invalid input, boundary values, and one failure path that crosses component boundaries.
- Verify defaults, derived fields, context propagation, and error mapping are preserved across the chain.

## 04 vs 05 Scope

- Stage 04 must run integration tests for the current feature once all related tasks are done.
- Stage 05 must run all relevant integration suites for the whole iteration and report uncovered chains.

## Evidence

Record the component chain, command executed, pass/fail result, and uncovered links in the test report.
