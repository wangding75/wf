# Batch/Job Testing Standard

> Language-neutral rules for batch jobs, scheduled jobs, and offline workers.

## When Required

Apply this standard when the feature processes records without a direct user request, including scheduled jobs, ETL tasks, migrations, and offline workers.

## Required Coverage

- Run the job through its public job entry point or scheduler adapter.
- Verify input selection, transformation, output writes, and completion status.
- Cover empty input, partial failure, retry, idempotent rerun, and duplicate input.
- Assert checkpoints, cursors, locks, or progress markers when present.
- Verify the job can be safely interrupted or rerun according to the design contract.

## Evidence

The test report must include input fixture, command or trigger used, output assertions, rerun result, and recovery behavior.
