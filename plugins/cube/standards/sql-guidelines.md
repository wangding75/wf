# SQL Generation Guidelines

> Rules for designing and reviewing SQL-producing features across dialects.

## Design Contract

If a feature outputs SQL, `design.md` must define a SQL Contract:

- Target dialects, such as MySQL, StarRocks, ClickHouse, or Hive.
- Expected SQL template for fixed-shape queries, or generation rules for dynamic queries.
- Input-to-output examples for representative cases.
- Required clauses, join predicates, grouping, ordering, parameters, and time-window semantics.
- Forbidden patterns that would be syntactically valid but semantically wrong.

## General Rules

- Every selected non-aggregated field in an aggregate query must be grouped or otherwise functionally determined.
- Joins must use explicit predicates, for example `a.user_id = b.user_id`; bare columns are not valid join contracts.
- The design must state whether filters apply before or after aggregation.
- Time-window queries must state the anchor event and boundary inclusivity.
- Query generators must keep parameter values separate from SQL text when the target API supports binding.
- Expected SQL comparisons should normalize whitespace and aliases unless those are part of the public contract.

## Dialect Notes

- MySQL: document `DATE_ADD`, interval syntax, identifier quoting, and `ONLY_FULL_GROUP_BY` assumptions.
- StarRocks: document MySQL compatibility assumptions, date functions, partition filters, and join limitations.
- ClickHouse: document interval/date functions, strict type conversions, array functions, and distributed table constraints.
- Hive: document date conversion, partition filters, CTE support, and execution-engine limitations.

## Review Checklist

- Does SQL match the Output Contract in `design.md`?
- Are grouping and join predicates complete?
- Does aggregation happen at the correct point in the business flow?
- Does the query preserve multi-event and out-of-order event semantics?
- Has each target dialect been syntax-checked or explicitly marked unsupported?
