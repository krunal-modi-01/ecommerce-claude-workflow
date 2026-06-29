# orders

**Tier:** 2  
**Parallelizable with:** catalog  
**Depends on:** db-schema, identity  
**Consumed by:** checkout, web, admin

---

## Responsibility

Owns all order records: creation, retrieval, and status transitions. Enforces the valid status lifecycle and scopes read access strictly to the correct party (buyer sees own orders; seller sees orders containing their products; admin sees all). Exposes `createOrder` as the write entry point called by `checkout` after a successful payment webhook.

---

## Interface

### Create (called by checkout only)

```
createOrder(data: CreateOrderInput) → Promise<Order>
```
Persists a new order and its line items atomically. Sets initial status to `"paid"`.

```
CreateOrderInput {
  buyerId:      UserId
  sellerId:     UserId
  stripePaymentIntentId: string
  items:        Array<{
    productId:      ProductId
    quantity:       number
    unitPriceCents: Money
  }>
  shippingAddress: {
    name:    string
    line1:   string
    city:    string
    state:   string
    postal:  string
    country: string   // ISO 3166-1 alpha-2
  }
  totalCents: Money
}
```
`totalCents` is the authoritative total computed by `checkout` — it is stored as-is and never recomputed by this module. Throws `ConflictError` if an order with the same `stripePaymentIntentId` already exists (idempotency guard).

---

### Read — Buyer

```
getOrdersByBuyer(
  userId: UserId,
  cursor?: Cursor
) → Promise<{ items: Order[], nextCursor?: Cursor }>
```
Returns orders where `buyerId = userId`, sorted by `createdAt` descending, paginated at 20 per page. Each item includes `id`, `status`, `totalCents`, `createdAt`, and seller display name.

---

```
getOrder(
  orderId: OrderId,
  requesterId: UserId
) → Promise<Order>
```
Returns full order detail including line items and shipping address. Access rules enforced here:
- Buyer: only if `order.buyerId === requesterId`
- Seller: only if `order.sellerId === requesterId` — line items are scoped to their products only
- Admin: unrestricted

Throws `NotFoundError` if the order does not exist or the requester is not authorised.

---

### Read — Seller

```
getOrdersBySeller(
  sellerId: UserId,
  cursor?: Cursor
) → Promise<{ items: Order[], nextCursor?: Cursor }>
```
Returns orders where `sellerId = sellerId`, sorted by `createdAt` descending, paginated at 20 per page.

---

### Read — Admin

```
getAllOrders(
  adminId: UserId,
  cursor?: Cursor
) → Promise<{ items: Order[], nextCursor?: Cursor }>
```
Returns all orders across all buyers and sellers. Throws `ForbiddenError` if `adminId`'s role is not `"admin"`.

---

### Status Transition — Seller

```
markShipped(
  orderId: OrderId,
  sellerId: UserId,
  trackingNumber?: string
) → Promise<Order>
```
Transitions the order from `"paid"` to `"shipped"`. Optionally sets `trackingNumber` (max 100 chars). Throws `ConflictError` if the current status is not `"paid"`. Throws `ForbiddenError` if `sellerId` does not own the order.

---

### Error Cases

| Condition | Error | HTTP |
|-----------|-------|------|
| Order not found or requester not authorised | `NotFoundError` | 404 |
| Duplicate `stripePaymentIntentId` | `ConflictError` | 409 |
| Invalid status transition | `ConflictError` | 409 |
| Seller calls `getAllOrders` | `ForbiddenError` | 403 |
| Seller marks shipped on another seller's order | `ForbiddenError` | 403 |

---

## Internal Invariants

- `createOrder` is wrapped in a DB transaction — the `orders` row and all `order_items` rows are inserted together or not at all.
- Status transitions allowed: `paid → shipped`, `paid → cancelled`. No other transitions are valid in v1.
- `totalCents` stored on the order is set at creation time and never updated.
- A seller can only see line items from their own products — no cross-seller data leaks through `getOrder`.

---

## Explicit Non-Responsibilities

- Does not process payments or call Stripe.
- Does not clear the cart — that is `cart`'s responsibility, called by `checkout`.
- Does not send emails — that is `email-service`'s responsibility, called by `checkout`.
- Does not handle refunds, returns, or disputes.
- Does not set order status to `"delivered"` programmatically in v1 — delivery confirmation is a manual step outside the platform.
