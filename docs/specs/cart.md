# cart

**Tier:** 3  
**Parallelizable with:** nothing at this tier  
**Depends on:** db-schema, identity, catalog  
**Consumed by:** checkout, web

---

## Responsibility

Owns the server-side shopping cart for each authenticated buyer. Manages line items, enforces the single-seller constraint, captures price snapshots at add-time, and computes cart totals server-side on every read. Exposes `getCartForCheckout` as the read interface for the `checkout` module.

---

## Interface

### Read

```
getCart(userId: UserId) → Promise<Cart>
```
Returns the buyer's current cart. If no cart exists, returns an empty cart (not an error).

```
Cart {
  userId:      UserId
  sellerId:    UserId | null     // null when cart is empty
  items:       CartLineItem[]
  totalCents:  Money             // computed server-side: Σ(snapshotPrice × qty) + Σ(shipping × qty)
}

CartLineItem {
  productId:          ProductId
  productTitle:       string
  quantity:           number
  snapshotPriceCents: Money
  shippingCents:      Money
  lineTotalCents:     Money      // (snapshotPrice + shipping) × quantity
}
```
`totalCents` and `lineTotalCents` are computed fresh on every call — they are never stored.

---

```
getCartForCheckout(userId: UserId) → Promise<CartCheckoutView>
```
Returns everything `checkout` needs to create a Payment Intent: the cart total and the seller's Stripe Connect account ID.

```
CartCheckoutView {
  userId:                  UserId
  sellerId:                UserId
  sellerStripeAccountId:   string
  items:                   CartLineItem[]
  totalCents:              Money
}
```
Throws `ValidationError` if the cart is empty. Throws `ValidationError` if the seller's Stripe Connect onboarding is not complete (checked via `identity.getSellerConnectStatus`).

---

### Mutate

```
addItem(
  userId:    UserId,
  productId: ProductId,
  quantity:  number      // positive integer, min 1
) → Promise<Cart>
```
Adds a product to the cart or increments quantity if already present.

Before adding:
- Calls `catalog.checkStock(productId)` — throws `ConflictError` (HTTP 409) if `stock === 0`.
- Checks single-seller constraint: if the cart already contains items from a different seller, throws `ConflictError` with a message explaining the conflict.
- Records `snapshotPriceCents` from the current product price at the moment of adding.

Returns the updated `Cart`.

---

```
updateItem(
  userId:    UserId,
  productId: ProductId,
  quantity:  number      // positive integer, min 1
) → Promise<Cart>
```
Sets the quantity for an existing line item. Throws `NotFoundError` if the item is not in the cart. Does not re-check stock (the buyer is adjusting an item they already added).

---

```
removeItem(
  userId:    UserId,
  productId: ProductId
) → Promise<Cart>
```
Removes a line item from the cart. Throws `NotFoundError` if the item is not in the cart. If this was the last item, the cart becomes empty (`sellerId` set to null).

---

```
clearCart(userId: UserId) → Promise<void>
```
Removes all line items from the cart. Called by `checkout` after a successful order creation. Always succeeds — clearing an already-empty cart is a no-op.

---

### Error Cases

| Condition | Error | HTTP |
|-----------|-------|------|
| Product out of stock on add | `ConflictError` | 409 |
| Adding product from a different seller | `ConflictError` | 409 |
| Item not in cart on update/remove | `NotFoundError` | 404 |
| Cart empty on `getCartForCheckout` | `ValidationError` | 422 |
| Seller onboarding incomplete on `getCartForCheckout` | `ValidationError` | 422 |
| `quantity` less than 1 | `ValidationError` | 422 |

---

## Internal Invariants

- A cart never contains items from more than one seller. This is checked on every `addItem`, not just at checkout.
- `snapshotPriceCents` is set once when the item is added and is never updated even if the product price changes later.
- `totalCents` is always recomputed from line items on read — it is not stored in the database.
- `shippingCents` in the line item is the product's current shipping cost at the time of `getCart` — it is fetched live, not snapshotted.

---

## Explicit Non-Responsibilities

- Does not create orders or process payments.
- Does not support guest (unauthenticated) carts.
- Does not implement saved-for-later or wishlists.
- Does not enforce stock reservation — a product might sell out between add and checkout; `checkout` is responsible for detecting that case.
- Does not apply discount codes or promotions.
