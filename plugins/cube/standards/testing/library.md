# Library/API Testing Standard

> Language-neutral rules for SDKs, libraries, and reusable modules.

## When Required

Apply this standard when the feature exposes a public library API, SDK method, reusable module, or extension point.

## Required Coverage

- Test through the public API, not private helpers.
- Assert input validation, return values, errors, defaults, and backward compatibility.
- Cover boundary values and representative integration with a minimal consumer.
- Verify public types, method names, and serialization formats remain stable unless the design declares a breaking change.
- Include examples or contract tests for extension points.

## Evidence

The test report must include public APIs covered, compatibility notes, and any intentionally unsupported behavior.
