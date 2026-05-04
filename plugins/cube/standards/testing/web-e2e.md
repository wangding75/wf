# Web/API End-to-End Testing Standard

> Language-neutral rules for Web/API projects and features.

## When Required

Apply this standard when the project exposes Web/API endpoints or the current feature changes an API entry point. This rule is independent of implementation language or framework.

## Required Coverage

- Start the service or an equivalent framework test environment.
- Send a request through the public HTTP/API entry point.
- Exercise the full route from request handling through application/domain logic to response creation.
- Assert status code, response schema, business fields, error code format, and important headers.
- Cover at least one successful request, one validation failure, and one domain failure.
- Include authentication, authorization, tenant, locale, or trace context when the feature depends on them.

## Acceptable Execution Forms

- Real service process plus HTTP client.
- Framework-managed server or in-process API test harness.
- Containerized dependencies for databases, queues, or external services.

If the service cannot be started, document the blocker and use the closest equivalent entry-level test. The gap must be reported as a risk in Stage 05.

## Evidence

The test report must include the endpoint, request shape, command used, response assertions, and any untested external dependency.
