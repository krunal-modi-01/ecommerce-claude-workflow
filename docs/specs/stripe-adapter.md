# stripe-adapter

**Tier:** 0  
**Parallelizable with:** db-schema, email-service  
**Depends on:** nothing  
**Consumed by:** identity, checkout

---

## Responsibility

Single point of contact with the Stripe API. Wraps the Stripe Node SDK so that no other module imports from `stripe` directly. Handles Stripe Connect Express account creation, Payment Intents, fund transfers, and webhook signature verification.

This unit has no knowledge of users, products, carts, or orders — it only knows about Stripe-level concepts.

---

## Interface

### Inputs / Outputs

```
createConnectOnboardingUrl(
  stripeAccountId: string,
  returnUrl: string,
  refreshUrl: string
) → Promise<string>
```
Creates a Stripe Connect Account Link for an existing Express account and returns the redirect URL. The Express account must have been created beforehand via Stripe (the caller is responsible for storing the resulting `stripeAccountId`).

---

```
createConnectAccount() → Promise<{ stripeAccountId: string }>
```
Creates a new Stripe Connect Express account and returns its ID. Called once during seller registration. The returned `stripeAccountId` is stored on the `User` row by `identity`.

---

```
getConnectAccountStatus(
  stripeAccountId: string
) → Promise<{ chargesEnabled: boolean }>
```
Returns whether the connected account can accept charges (i.e., onboarding is complete).

---

```
createPaymentIntent(
  amountCents: Money,
  currency: string,
  connectedAccountId: string
) → Promise<{ paymentIntentId: string, clientSecret: string }>
```
Creates a Stripe Payment Intent on behalf of the connected seller account. `amountCents` must be a positive integer. Returns the `clientSecret` for the browser to complete payment via Stripe.js, and `paymentIntentId` for idempotency tracking.

---

```
verifyWebhookSignature(
  rawBody: Buffer,
  stripeSignatureHeader: string
) → StripeEvent
```
Verifies the `Stripe-Signature` header against the raw request body using the webhook secret from environment config. Returns the parsed Stripe event on success. Throws `WebhookSignatureError` if the signature is invalid.

---

```
createTransfer(
  amountCents: Money,
  connectedAccountId: string,
  sourcePaymentIntentId: string
) → Promise<void>
```
Transfers funds from the platform account to the seller's connected account after a successful payment. `sourcePaymentIntentId` is used as the transfer's source transaction reference.

---

### Error Cases

| Condition | Thrown |
|-----------|--------|
| Invalid webhook signature | `WebhookSignatureError` |
| Stripe API error (network, rate limit, invalid params) | `StripeAdapterError` wrapping original Stripe error |
| `amountCents` is not a positive integer | `ValueError` before calling Stripe |

---

## Internal Invariants

- Stripe SDK is initialised once with the secret key from environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). The adapter never reads these values outside of initialisation.
- `createPaymentIntent` always sets `currency` as lowercase. Callers should pass `"usd"` (or the relevant currency code).
- The adapter does not retry on failure — retry logic belongs in the caller.

---

## Explicit Non-Responsibilities

- Does not write to the database.
- Does not know about `User`, `Order`, or any internal types — it only deals in Stripe IDs and money amounts.
- Does not implement idempotency (e.g., deduplicating webhook events) — that is `checkout`'s responsibility.
- Does not handle refunds or disputes in v1.
