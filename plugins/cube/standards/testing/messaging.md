# Messaging Testing Standard

> Language-neutral rules for message producers and consumers.

## When Required

Apply this standard when the feature publishes, consumes, transforms, or routes messages.

## Required Coverage

- Exercise the public producer or consumer entry point.
- Verify message schema, headers, keys, ordering assumptions, and routing target.
- Cover successful processing, invalid message, duplicate message, retry, and dead-letter behavior.
- Assert idempotency for consumers that may receive duplicates.
- Use an embedded broker, test container, or faithful in-memory broker only when it preserves the relevant delivery semantics.

## Evidence

The test report must include topic/queue names, message fixtures, delivery behavior, retry/dead-letter assertions, and untested broker assumptions.
