# SQL/Query Generator Testing Standard

> Language-neutral rules for features whose output is SQL or a query plan.

## When Required

Apply this standard when a method, API, CLI, or handler produces SQL, query DSL, query AST, or executable query plans.

## Required Coverage

- Derive expected SQL or query rules from `design.md`; do not invent expectations in tests.
- Normalize formatting before string comparison unless formatting is part of the contract.
- Verify structure: selected fields, CTEs/subqueries, joins, filters, grouping, ordering, limits, windows, and parameters.
- Verify syntax against the target dialect using parser, `EXPLAIN`, dry-run, or the database engine when available.
- Verify semantics with fixture data whenever the query represents business logic.

## SQL Semantics

Tests must catch ordering and aggregation mistakes, including:

- Missing `GROUP BY` for non-aggregated selected fields.
- Incomplete join predicates, such as a bare boolean column instead of equality.
- Filtering after aggregation when the business rule requires filtering before aggregation.
- Time-window anchoring to the wrong step or event.
- Global earliest-event aggregation that hides valid later events.

## Evidence

Store expected SQL, fixture data, and expected results as test resources when practical. Stage 05 must report the dialect, syntax validation method, fixture execution result, and uncovered query variants.
