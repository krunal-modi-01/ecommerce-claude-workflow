# ADR-0003: Inter-Module Communication

**Status:** Accepted  
**Date:** 2026-06-29

---

## Context

The marketplace is structured as a modular monolith with bounded modules at defined dependency tiers (db-schema, stripe-adapter, email-service → identity → catalog/orders → cart → checkout → web/admin). Modules at higher tiers must call modules at lower tiers.

Example: `checkout` (Tier 4) calls `cart.getCartForCheckout()`, `orders.createOrder()`, `stripe-adapter.createPaymentIntent()`, and `email-service.sendOrderConfirmation()` — all in the same request/webhook cycle, some of which must be wrapped in a single DB transaction.

The question is how those cross-module calls are made: direct function calls, an in-process event bus, or HTTP between co-located modules.

---

## Options

### A — Direct typed TypeScript calls via module/index.ts

Each module exports a public interface from its `index.ts`. Callers import only from `module/index.ts`, never from internal files. Calls are ordinary synchronous or async TypeScript function calls in the same process.

- The TypeScript compiler enforces the contract at build time: a breaking change to a module's public interface is a compile error in all callers.
- Zero overhead: no serialization, no dispatch, no network hop.
- Linear call stacks make debugging straightforward.
- Callers can pass a shared Drizzle transaction object, allowing multiple module calls to participate in the same atomic DB transaction. The `checkout` webhook handler wraps `orders.createOrder()`, `cart.clearCart()`, and the `processed_webhook_events` insert in a single transaction — guaranteeing that a partial failure leaves no inconsistent state.
- Coupling risk is managed by the interface boundary: internal implementation details are never exposed.

### B — In-process typed event bus (e.g., typed EventEmitter)

Modules publish and subscribe to typed events. Producers have no compile-time knowledge of their consumers.

- Useful for genuine one-way side effects where the producer should not know its consumers (e.g., audit log, analytics).
- Does not satisfy flows that require a return value: `checkout` needs the validated cart from `cart.getCartForCheckout()` before it can create a Payment Intent. A synchronous return value over an event bus requires a request/response pattern that negates the decoupling benefit.
- Event handlers typically run outside any ongoing DB transaction; wiring them into a transaction requires explicit plumbing that is more complex than a direct call.
- Harder to debug: no linear call stack for event-driven flows; event key strings are not statically verified by the compiler.

### C — HTTP between modules (loopback or localhost)

Each module exposes an HTTP endpoint; callers make HTTP requests even within the same process.

- Makes future microservice extraction trivial: the only change is updating the URL.
- Completely unnecessary for a co-located modular monolith: adds serialization overhead, requires service discovery (even on localhost), breaks compile-time contract verification, and makes cross-module DB transactions impossible.
- Contradicts the project's architectural stance ("Do NOT split into microservices without an ADR") by baking in microservice-oriented patterns before there is a need for them.

---

## Decision

**Option A — Direct typed TypeScript calls through `module/index.ts` — for all synchronous, transactional, and return-value flows.**

Option B (typed in-process event bus) is an acceptable supplement for genuine fire-and-forget side effects where no return value is needed and loose coupling is explicitly desired (e.g., a future audit-log module). It is not appropriate for any flow in the current dependency graph. Option C has no place in a modular monolith.

---

## Consequences

**Positive**

- Broken module interfaces are caught at compile time (`npm run typecheck`), not at runtime.
- The `checkout` webhook handler's atomicity guarantee (create order + clear cart + record event in one transaction) is achievable only with in-process direct calls sharing a database connection.
- No infrastructure additions: no event bus library, no service discovery, no serialization layer.
- Refactoring a module's internals without changing its public interface requires no changes in callers.

**Negative / Accepted tradeoffs**

- A change to a module's public interface forces all callers to update. In a single-team monorepo this is a feature (enforced contracts), but it means interface changes have a wider blast radius than in a loosely coupled system.
- All calls are synchronous from the caller's perspective (even if async/await). There is no built-in backpressure or rate-limiting on cross-module calls. This is fine for v1 request volumes.
- The `email-service.sendOrderConfirmation()` call in the webhook handler is explicitly excluded from the DB transaction (email delivery cannot be rolled back). This is documented as an intentional invariant: email failure is logged but does not abort the order creation.
