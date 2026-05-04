# API Contract Template

> Every interface must define five production contracts. This is not optional — interfaces missing contracts will fail gate verification.

## Schema as Source of Truth

Interface definitions have two forms, but only one is authoritative:

| Form | Role | Authority |
|------|------|-----------|
| Schema code (Record/Model/Type definitions) | Machine-executable source of truth, tests derived from this | **Authoritative** |
| `api-spec.md` | Human-readable narrative (design motivation, production contracts) | Supplementary |

**Any conflict: schema wins.** Markdown is for understanding, not for test generation.

## The Five Contracts

Every interface in `api-spec.md` must document all five:

### 1. Functional Contract (Schema)

Defined in source code model classes. References the Request/Response models:

```
See source code: <RequestModel> / <ResponseModel>
```

### 2. SLO Contract

| Metric | Target |
|--------|--------|
| P50 Latency | < 50ms |
| P99 Latency | < 300ms |
| Availability | 99.5% |
| Error Rate | < 0.1% |

Machine-readable SLO targets (define per module in design document or config):

```yaml
modules:
  user_service:
    slo:
      p50_latency_ms: 50
      p99_latency_ms: 300
      availability: 0.995
      error_rate: 0.001
```

### 3. Observability Contract

**Required log fields:**
- `trace_id` (propagated across request chain)
- Business parameters relevant to the interface
- `duration_ms` (performance tracking)
- External dependency hit markers

**Required metrics (Prometheus-style):**
- `<project>_<module>_requests_total{...}` (Counter)
- `<project>_<module>_duration_seconds{...}` (Histogram)

### 4. Degradation Contract

| Scenario | Degradation Strategy |
|----------|---------------------|
| Primary upstream timeout | Switch to fallback source |
| Fallback also fails | Return cached data (with stale marker) |
| No cache available | Return explicit error code, enqueue for retry |

### 5. Security Contract

- Authentication method
- Rate limiting threshold
- Input validation (enforced by schema field constraints)
- No sensitive data in GET parameters
- No credentials in logs

## SLO Specification

SLO targets should be defined per module in the design document or project config. TDD tests in stage 04-development derive assertions from these targets:

```yaml
modules:
  user_service:
    slo:
      p50_latency_ms: 50
      p99_latency_ms: 300
      availability: 0.995
      error_rate: 0.001
    logging_required_fields:
      - trace_id
      - user_id
      - duration_ms
    metrics_required:
      - name: app_user_requests_total
        type: counter
        labels: [endpoint, status]
      - name: app_user_duration_seconds
        type: histogram
        labels: [endpoint]
    fallback_required: true
```

## Schema File Organization

Schema files are part of the project source code in `${paths.source_dir}`. Design documents live in `.cube/iterations/{branch}/`.

## Prohibited

- Schema-less interfaces (no code schema = no test source of truth)
- Inconsistent response formats (error and success must use same envelope)
- HTTP 200 for business errors
- Missing SLO/logging/degradation contracts
- Sensitive data in GET parameters
