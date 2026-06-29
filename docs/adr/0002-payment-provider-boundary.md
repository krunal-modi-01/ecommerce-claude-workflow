# ADR-0002: Payment Provider Integration Boundary

**Status:** Accepted  
**Date:** 2026-06-29

---

## Context

The platform uses Stripe for three distinct concerns: seller onboarding (Stripe Connect Express accounts), buyer payment collection (Payment Intents), and webhook event verification. The Stripe Node SDK must be initialised with a secret key and a webhook secret from environment config.

The question is whether the Stripe SDK is imported directly by the modules that need it (`identity` for Connect, `checkout` for Payment Intents and webhooks) or whether it is wrapped behind a single internal adapter that all callers go through.

The project is a modular monolith; module boundaries are enforced by convention (imports only from `module/index.ts`). A microservice split is out of scope for v1.

---

## Options

### A — Isolated stripe-adapter anti-corruption layer

A dedicated `stripe-adapter` module (Tier 0) is the sole importer of the `stripe` npm package. It exposes domain-language functions — `createConnectAccount()`, `createPaymentIntent(amountCents, currency, connectedAccountId)`, `verifyWebhookSignature(rawBody, signatureHeader)`, etc. — with domain types (`Money`, not raw Stripe parameter objects). No Stripe types leak into other modules.

- PCI audit surface is contained in one file; secret key initialisation happens once.
- Stripe SDK version upgrades touch only the adapter.
- `checkout` and `identity` unit tests mock the adapter interface directly; no HTTP interception of `api.stripe.com` is needed.
- Stripe-specific concepts (rate limits, idempotency keys, Stripe error types) are translated into domain errors (`StripeAdapterError`, `WebhookSignatureError`) at the adapter boundary.

### B — Direct Stripe SDK calls from checkout and identity

Each module that needs Stripe imports it directly.

- Fewer abstraction layers; developers read Stripe docs and call the SDK directly without indirection.
- Stripe types (`Stripe.PaymentIntent`, `Stripe.Account`, etc.) bleed into the business logic of `checkout` and `identity`.
- PCI-relevant code (secret key use, webhook verification) is scattered across multiple modules.
- Testing requires mocking or intercepting Stripe HTTP calls in every module that uses it.
- A Stripe SDK major version upgrade requires coordinated changes across multiple modules.

### C — Separate payment microservice

A standalone service handles all Stripe interactions; `checkout` and `identity` call it over HTTP.

- Full isolation at a network boundary; future independent deployment is trivially possible.
- Introduces HTTP round-trip latency, distributed transaction complexity (the webhook handler's DB transaction spans `orders.createOrder`, `cart.clearCart`, and `processed_webhook_events` — impossible to keep atomic across a service boundary without a saga or two-phase commit), and operational overhead.
- Contradicts the modular-monolith invariant: "Do NOT split into microservices without an ADR."

---

## Decision

**Option A — Isolated stripe-adapter anti-corruption layer.**

`stripe-adapter` is a Tier-0 module consumed by `identity` (Connect account creation and onboarding URL generation) and `checkout` (Payment Intent creation and webhook verification). Its interface uses domain primitives only: `Money` (integer cents), Stripe account IDs as plain strings, and domain error types. The `stripe` npm package is never imported outside this module.

---

## Consequences

**Positive**

- Secret key handling and webhook signature verification are confined to one file, minimising PCI audit scope.
- Vendor substitution (hypothetical) or a Stripe API major version change requires changes only in `stripe-adapter`.
- `checkout` and `identity` are testable in isolation by mocking the adapter interface — no network stubs required.
- Domain errors (`StripeAdapterError`, `WebhookSignatureError`) give callers a stable error contract independent of Stripe SDK error shapes.

**Negative / Accepted tradeoffs**

- The adapter interface must evolve in step with how callers actually use Stripe. If a new Stripe feature requires a new parameter (e.g., adding `metadata` to Payment Intents for shipping address storage, as used in v1), the adapter interface must be updated before `checkout` can use it.
- The adapter does not retry on transient Stripe failures — retry logic is the caller's responsibility. This is a correct separation but requires callers (`checkout`, `identity`) to be aware of and handle `StripeAdapterError`.
- One additional indirection layer for developers who want to trace a call end-to-end; tooling (stack traces, type-go-to-definition) makes this negligible.
