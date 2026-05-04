# CLI Testing Standard

> Language-neutral rules for command-line interfaces.

## When Required

Apply this standard when the feature adds or changes a CLI command, subcommand, option, or command output.

## Required Coverage

- Execute the command through the public binary or script entry point.
- Assert exit code, stdout, stderr, and filesystem side effects.
- Cover valid arguments, missing required arguments, invalid values, help output, and failure handling.
- Verify output formats intended for machines remain stable.
- Confirm commands do not mutate files outside the declared scope.

## Evidence

The test report must include command lines, exit codes, important output assertions, and side-effect paths.
