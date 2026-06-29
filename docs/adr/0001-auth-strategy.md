# ADR-0001: Authentication Strategy

**Status:** Accepted  
**Date:** 2026-06-29

---

## Context

The marketplace is a React 18 SPA backed by an Express API. Every request to a protected route must carry a credential that identifies the caller and their role (`buyer`, `seller`, `admin`). Three standard mechanisms exist for a browser-to-API flow:

1. JWT stored in an httpOnly cookie
2. JWT stored by the client and sent as an `Authorization: Bearer` header
3. Server-side sessions with a session identifier in a cookie

The credential must be resistant to the two primary browser-side attacks — XSS (JavaScript reading the token) and CSRF (forged cross-origin requests) — without introducing operational dependencies beyond what the stack already has.

---

## Options

### A — JWT in httpOnly, Secure, SameSite=Strict cookie

The server issues a signed JWT and writes it to a cookie with the flags `httpOnly`, `Secure`, `SameSite=Strict`. The browser sends the cookie automatically on every same-origin request; the server verifies the JWT signature on each request using `JWT_SECRET` from environment config.

- JavaScript cannot read the cookie (`httpOnly`), eliminating XSS-based token theft.
- `SameSite=Strict` prevents the browser from attaching the cookie to any cross-origin-initiated request, eliminating the standard CSRF vector for a same-origin SPA.
- Verification is stateless: no database or cache lookup per request.
- Logout is a cookie-clear (`Set-Cookie: auth_token=; Max-Age=0`); no server-side state to remove.
- A stolen cookie (e.g., via network interception) is valid until expiry; no per-token revocation without a server-side blocklist.

### B — JWT in Authorization Bearer header

The client stores the JWT (typically in `localStorage` or in-memory) and attaches it as `Authorization: Bearer <token>` on every request.

- `localStorage` is accessible to any JavaScript running on the page, making it a target for XSS attacks.
- In-memory storage survives only until the page is refreshed; a silent-refresh endpoint is needed to restore the session.
- More natural for mobile clients and server-to-server calls; not needed here.
- `NEVER localStorage` is an explicit project invariant; this option is non-compliant.

### C — Server-side sessions (express-session + DB/Redis)

The server stores session state in a database table or Redis; the client holds only an opaque session ID in a cookie.

- Supports instant revocation: deleting the session row invalidates all associated requests immediately.
- Scales horizontally only with sticky sessions or a shared store; adding Redis introduces an operational dependency not present in the current stack.
- Stateful: every authenticated request requires a DB or Redis lookup.

---

## Decision

**Option A — JWT in httpOnly Secure SameSite=Strict cookie.**

`SameSite=Strict` + `httpOnly` + `Secure` addresses both XSS and CSRF without additional infrastructure. The `identity` module issues the JWT via `login()`, writes it to the `auth_token` cookie, and exposes `requireAuth(role?)` middleware that all other modules mount on protected routes. JWT payload: `{ sub: userId, role, iat, exp }` with a 7-day expiry.

---

## Consequences

**Positive**

- Token is inaccessible to JavaScript; XSS cannot exfiltrate it.
- CSRF is mitigated for same-origin SPAs by `SameSite=Strict` without needing CSRF tokens.
- Stateless verification requires only `JWT_SECRET`; no DB lookup per request.
- No infrastructure beyond the existing PostgreSQL + Express stack.

**Negative / Accepted tradeoffs**

- A stolen token (e.g., compromised TLS) remains valid for up to 7 days; there is no revocation list in v1. Token rotation or a server-side blocklist is deferred to v2.
- Role is embedded in the JWT; a role change (if ever added) would not take effect until the token expires or the user logs in again. Roles are immutable in v1, making this a non-issue currently.
- `SameSite=Strict` breaks flows where the browser arrives from an external redirect with an active session (e.g., a user clicking a link in an email). Stripe Connect onboarding redirects back to the platform; those redirects are unauthenticated deep links, so this is not an issue in the current flow.
