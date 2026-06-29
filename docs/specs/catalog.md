# catalog

**Tier:** 2  
**Parallelizable with:** orders  
**Depends on:** db-schema, identity  
**Consumed by:** cart, web, admin

---

## Responsibility

Owns the full product lifecycle: creation, editing, publish/unpublish, and deletion. Owns product discovery: paginated listing, full-text search, category filtering, and detail retrieval. Enforces all publish preconditions (image required, seller onboarding complete). Exposes a `checkStock` function used by `cart` to prevent out-of-stock additions.

---

## Interface

### Product Discovery (public — no auth required)

```
listProducts(filters: {
  query?:      string    // full-text search term
  categoryId?: string
  cursor?:     Cursor
  limit?:      number    // default 20, max 100
}) → Promise<{
  items:       Product[]
  nextCursor?: Cursor
}>
```
Returns published products only. When `query` is present, results are ranked by PostgreSQL `ts_rank` on the `searchVector` column. Category filter is applied as an `AND` condition with the search. Pagination is cursor-based.

---

```
getProduct(id: ProductId) → Promise<Product>
```
Returns a published product. If the caller is the owning seller or an admin, also returns unpublished products. Throws `NotFoundError` if the product does not exist or is not accessible to the caller.

---

### Product Management (seller — requires `requireAuth('seller')`)

```
createProduct(
  sellerId: UserId,
  data: ProductInput
) → Promise<Product>
```
Creates a product in unpublished state. Throws `ForbiddenError` if `sellerId`'s Stripe Connect onboarding is not complete (checked via `identity.getSellerConnectStatus`).

```
ProductInput {
  title:          string      // 1–200 chars
  description:    string      // 1–5000 chars
  priceCents:     Money       // positive integer
  shippingCents:  Money       // non-negative integer
  categoryId:     string
  stockQuantity:  number      // non-negative integer
  imageUrl:       string      // valid URL
}
```

---

```
updateProduct(
  sellerId: UserId,
  productId: ProductId,
  changes: Partial<ProductInput>
) → Promise<Product>
```
Updates fields on the seller's own product. Throws `NotFoundError` if the product doesn't exist or belongs to a different seller.

---

```
setPublished(
  actorId: UserId,
  productId: ProductId,
  published: boolean
) → Promise<Product>
```
Publishes or unpublishes a product. The actor must be the owning seller or an admin. Before publishing, validates: `imageUrl` is set, `priceCents > 0`, and (for sellers) Stripe Connect onboarding is complete. Throws `ValidationError` if preconditions are unmet.

---

```
deleteProduct(
  adminId: UserId,
  productId: ProductId
) → Promise<void>
```
Permanently deletes a product. Only admins may call this. Throws `ForbiddenError` for non-admins.

---

### Stock Query (used by cart)

```
checkStock(productId: ProductId) → Promise<number>
```
Returns the current `stockQuantity` for the product. Throws `NotFoundError` if the product does not exist or is unpublished.

---

### Error Cases

| Condition | Error | HTTP |
|-----------|-------|------|
| Product not found or inaccessible | `NotFoundError` | 404 |
| Seller's Stripe onboarding incomplete | `ForbiddenError` | 403 |
| Publish precondition not met | `ValidationError` | 422 |
| Non-admin calls `deleteProduct` | `ForbiddenError` | 403 |
| Seller edits another seller's product | `NotFoundError` | 404 |
| Invalid field value (negative price, etc.) | `ValidationError` | 422 |

---

## Internal Invariants

- `listProducts` never returns unpublished products unless the caller is the owning seller or an admin — this scoping is enforced in every query, not just the route handler.
- `priceCents` and `shippingCents` are validated as non-negative integers before any write. The module rejects floats.
- Full-text search uses `to_tsquery` with `websearch_to_tsquery` formatting to safely handle user input.
- Category IDs are validated against the seeded category table; unknown IDs return `ValidationError`.

---

## Explicit Non-Responsibilities

- Does not manage cart state or orders.
- Does not process payments or call Stripe directly — it only calls `identity.getSellerConnectStatus` for publish gating.
- Does not manage categories (fixed seed list, no CRUD).
- Does not handle product images (stores URL only, no upload).
- Does not enforce stock reservation — stock is a simple integer; `cart` reads it at add-time but no lock is held.
