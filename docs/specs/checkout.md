# checkout

**Tier:** 4  
**Parallelizable with:** nothing at this tier  
**Depends on:** db-schema, identity, cart, orders, stripe-adapter, email-service  
**Consumed by:** web

---

## Responsibility

Orchestrates the end-to-end payment flow. Has two jobs:

1. **Initiate** — validates the cart, creates a Stripe Payment Intent, and returns a `clientSecret` for the browser to complete payment.
2. **Confirm** — handles the `payment_intent.succeeded` Stripe webhook: idempotently records the event, creates the order, clears the cart, and sends the confirmation email.

This module owns no persistent data of its own — all state is delegated to `cart`, `orders`, and the `processed_webhook_events` table.

---

## Interface

### Initiate Checkout

```
initiateCheckout(
  userId: UserId,
  shippingAddress: ShippingAddress
) → Promise<{ clientSecret: string, paymentIntentId: string }>
```

Steps performed:
1. Calls `cart.getCartForCheckout(userId)` — validates cart is non-empty and seller onboarding is complete.
2. Validates `shippingAddress` (all required fields present, `country` is valid ISO 3166-1 alpha-2).
3. Calls `stripe-adapter.createPaymentIntent(totalCents, "usd", sellerStripeAccountId)`.
4. Returns `{ clientSecret, paymentIntentId }` to the caller.

No order is created at this point. The `shippingAddress` is not persisted here — it is passed back by the client as a field on the payment confirmation metadata so the webhook can access it, OR the client re-submits it alongside the webhook confirmation. See implementation note below.

> **Implementation note (v1 simplification):** The shipping address is stored temporarily in the Payment Intent's `metadata` object at the time of intent creation. The webhook handler reads it from the Stripe event's metadata when creating the order. This avoids a separate `pending_checkout` table in v1.

```
ShippingAddress {
  name:    string   // required, 1–200 chars
  line1:   string   // required, 1–200 chars
  city:    string   // required
  state:   string   // required
  postal:  string   // required
  country: string   // required, ISO 3166-1 alpha-2
}
```

---

### Handle Stripe Webhook

```
handleStripeWebhook(
  rawBody: Buffer,
  stripeSignatureHeader: string
) → Promise<void>
```

Steps performed:
1. Calls `stripe-adapter.verifyWebhookSignature(rawBody, stripeSignatureHeader)` — throws `WebhookSignatureError` on failure (caller returns HTTP 400).
2. For event type `payment_intent.succeeded` only:
   a. Checks `processed_webhook_events` for `stripeEventId` — if present, returns immediately (idempotency).
   b. Extracts order data from the event's `metadata` and `amount` fields.
   c. Calls `orders.createOrder(...)` to persist the order.
   d. Calls `cart.clearCart(buyerId)`.
   e. Calls `email-service.sendOrderConfirmation(...)`. Email failure is logged but does not throw.
   f. Inserts a row into `processed_webhook_events` with `stripeEventId`.
3. All other event types are acknowledged with no action.

The webhook handler wraps steps (c)–(f) in a DB transaction so that a partial failure does not leave inconsistent state.

---

### Error Cases

| Condition | Error | HTTP to Stripe |
|-----------|-------|----------------|
| Invalid webhook signature | `WebhookSignatureError` | 400 |
| Cart empty or seller not onboarded | `ValidationError` | — (surfaces to buyer before payment) |
| Invalid shipping address fields | `ValidationError` | — (surfaces to buyer before payment) |
| Duplicate webhook event | *(no-op, returns void)* | 200 |
| `orders.createOrder` throws `ConflictError` on duplicate `paymentIntentId` | *(no-op, idempotent)* | 200 |

Stripe requires HTTP 200 from webhook handlers to stop retrying. Any unhandled error in the webhook handler must be caught, logged, and still return 200 to Stripe to prevent infinite retries — except signature verification failure, which returns 400.

---

## Internal Invariants

- `initiateCheckout` never accepts a price or total from the client — `totalCents` always comes from `cart.getCartForCheckout`.
- The webhook handler processes `payment_intent.succeeded` exactly once per `stripeEventId`.
- The DB transaction in the webhook handler covers `orders.createOrder` + `cart.clearCart` + `processed_webhook_events` insert. Email sending happens outside the transaction.
- This module never directly queries the `products` or `users` tables — it goes through `cart`, `orders`, and `stripe-adapter`.

---

## Explicit Non-Responsibilities

- Does not own order records — delegates entirely to `orders`.
- Does not own cart state — delegates entirely to `cart`.
- Does not call the Stripe SDK directly — delegates entirely to `stripe-adapter`.
- Does not handle payment failures (buyer-facing) — the client handles Stripe.js errors; the server only handles the success webhook.
- Does not support refunds, disputes, or multi-seller carts in v1.
- Does not apply discount codes or taxes.
