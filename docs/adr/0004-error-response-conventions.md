# ADR-0004: API Error and Response Conventions

**Status:** Accepted  
**Date:** 2026-06-29

---

## Context

The Express API serves a React 18 SPA. The SPA must be able to display contextual error messages (e.g., "That email is already registered" vs. "Server error") rather than generic fallback text. This requires machine-readable error information in the response body, not just an HTTP status code.

`api/openapi.yaml` is frozen and is the single source of truth for both backend and frontend types (via `openapi-typescript`). The error format must integrate cleanly with OpenAPI 3.1 tooling.

The domain layer already defines a set of typed error classes (`ConflictError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `InvalidTokenError`, `WebhookSignatureError`) each mapping to a specific HTTP status code. The response format must represent these consistently.

---

## Options

### A — RFC 7807 Problem Details (application/problem+json)

On error, the API responds with `Content-Type: application/problem+json` and a body of the form:

```json
{
  "type": "urn:marketplace:error:conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "That email address is already registered."
}
```

Success responses use direct resource bodies with appropriate HTTP status codes (200, 201, 204).

- OpenAPI 3.1 has first-class support for `application/problem+json` response schemas; a reusable `ProblemDetails` component can be declared once and referenced across all operations.
- `openapi-typescript` generates a typed `ProblemDetails` interface; the React SPA can narrow on `response.ok` and type-assert the error body.
- The `type` URI is a stable, machine-readable error code. Client code branches on `type`, not on parsing `detail` strings.
- HTTP status codes remain semantically meaningful; caches, proxies, and monitoring tools can act on them correctly.
- `204 No Content` responses work naturally (no envelope to omit).

### B — Custom envelope ({ success, data, error })

Every response — success and error — uses the same shape:

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": { "code": "CONFLICT", "message": "..." } }
```

- All responses have one shape; some developers find this initially easier.
- HTTP status codes become decorative: client code branches on `success`, ignoring the HTTP layer. This defeats HTTP caching, CDN behaviour, and standard client-side fetch/axios error handling that keys on 2xx vs 4xx.
- `204 No Content` requires an envelope body (`{ success: true, data: null }`), which is a protocol violation.
- OpenAPI operation responses must all include the envelope schema, inflating generated types with a wrapper layer on every operation.
- Non-standard: OpenAPI tooling, REST clients (Insomnia, Postman), and API monitoring tools expect idiomatic HTTP, not an application-layer success flag.

### C — HTTP status codes only (no structured error body)

Errors are expressed purely through HTTP status codes with no body or a plain-text message.

- Maximally simple for the server.
- Completely inadequate for the SPA: the client cannot distinguish "email already taken" (409) from "seller already exists" (also 409) without a structured error body. UI error messages would be hardcoded per endpoint rather than driven by server response.
- `openapi.yaml` would have no error response schema to generate types from.

---

## Decision

**Option A — RFC 7807 Problem Details.**

`type` URIs follow the pattern `urn:marketplace:error:<code>` where `<code>` is a lowercase, hyphenated identifier. Success responses use direct resource bodies. A single `ProblemDetails` schema component in `openapi.yaml` is referenced by all error response entries.

**Error code mapping:**

| Domain Error | HTTP Status | type URI |
|---|---|---|
| `ConflictError` | 409 | `urn:marketplace:error:conflict` |
| `UnauthorizedError` | 401 | `urn:marketplace:error:unauthorized` |
| `ForbiddenError` | 403 | `urn:marketplace:error:forbidden` |
| `NotFoundError` | 404 | `urn:marketplace:error:not-found` |
| `ValidationError` | 422 | `urn:marketplace:error:validation` |
| `InvalidTokenError` | 400 | `urn:marketplace:error:invalid-token` |
| `WebhookSignatureError` | 400 | `urn:marketplace:error:webhook-signature` |
| Unhandled error | 500 | `urn:marketplace:error:internal` |

A single Express error-handler middleware intercepts all thrown domain errors, maps them to their HTTP status and `type` URI, and serializes the Problem Details body. The `detail` field carries a human-readable message safe to display in the UI.

---

## Consequences

**Positive**

- `openapi.yaml` declares one reusable `ProblemDetails` component; all 4xx/5xx responses reference it. Generated TypeScript types are clean and non-redundant.
- The React SPA branches on `type` URI for contextual UI copy; changing the `detail` string server-side does not require a client code change.
- HTTP semantics are preserved: monitoring, alerting, and CDN rules can use status codes directly.
- RFC-standard format means third-party HTTP clients, API test tools, and future integrations interpret errors without custom documentation.

**Negative / Accepted tradeoffs**

- Clients must branch on HTTP status code (2xx vs 4xx/5xx) rather than a uniform `success` flag. React Query and SWR already handle this natively; it is not additional complexity.
- The server error-handler middleware must set `Content-Type: application/problem+json` explicitly on error responses, which differs from the default `application/json`. A minor implementation detail, not a structural constraint.
- The `type` URI namespace (`urn:marketplace:error:*`) must be kept consistent across the codebase. New domain errors added in future must follow the same naming convention and be registered in this ADR's mapping table.
