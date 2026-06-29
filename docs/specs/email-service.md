# email-service

**Tier:** 0  
**Parallelizable with:** db-schema, stripe-adapter  
**Depends on:** nothing  
**Consumed by:** identity, checkout

---

## Responsibility

Sends transactional emails on behalf of the platform. All modules that need to send email call this unit — no module sends email directly. Abstracts the underlying email provider (e.g., Resend, SendGrid, Nodemailer) so that swapping providers requires no changes to callers.

In v1 the implementation may be a direct provider call (no background queue). If a queue is introduced later, the interface remains identical.

---

## Interface

### Inputs / Outputs

```
sendOrderConfirmation(
  to: string,
  order: OrderConfirmationData
) → Promise<void>
```
Sends an order confirmation email to the buyer after successful payment.

```
OrderConfirmationData {
  orderId:       OrderId
  buyerName:     string
  items:         Array<{ title: string, quantity: number, unitPriceCents: Money }>
  totalCents:    Money
  shippingAddress: {
    name:    string
    line1:   string
    city:    string
    state:   string
    postal:  string
    country: string
  }
}
```

---

```
sendPasswordReset(
  to: string,
  resetToken: string,
  expiresAt: Date
) → Promise<void>
```
Sends a password-reset link to the user. The link format is `{BASE_URL}/reset-password?token={resetToken}`. `BASE_URL` is read from environment config.

---

### Error Cases

| Condition | Thrown |
|-----------|--------|
| Provider API error or network failure | `EmailDeliveryError` with the provider's error message |
| Invalid `to` address format | `ValueError` before calling the provider |

Callers should treat `EmailDeliveryError` as non-fatal and log it — a failed confirmation email must not roll back an order or block a password reset from being stored.

---

## Internal Invariants

- Email provider credentials are read from environment variables at startup. The unit never accepts credentials as function arguments.
- `sendPasswordReset` does NOT generate the token — it only sends a token it receives. Token generation and storage are `identity`'s responsibility.
- Both functions are fire-and-forget from the caller's perspective (return `Promise<void>`); they do not return delivery receipts.

---

## Explicit Non-Responsibilities

- Does not generate, store, or validate tokens.
- Does not manage email templates in a CMS — templates are compiled into the application.
- Does not handle marketing or bulk emails.
- Does not track delivery status or bounces in v1.
- Does not implement a retry queue in v1 — failed sends surface as thrown errors.
