# db-schema

**Tier:** 0  
**Parallelizable with:** stripe-adapter, email-service  
**Depends on:** nothing  
**Consumed by:** identity, catalog, cart, orders, checkout

---

## Responsibility

Defines the PostgreSQL schema via Drizzle ORM: all table definitions, column types, foreign key relations, and indexes. Exports TypeScript row types used by every other module. Contains no business logic — it is a pure data shape contract.

Migration files are forward-only and applied via `npm run db:migrate`. Schema changes require a new migration file; no module may alter the schema directly.

---

## Interface

### Outputs — Exported Types

```
User {
  id:                    UserId
  email:                 string
  passwordHash:          string
  displayName:           string
  role:                  Role
  stripeAccountId:       string | null   // only set for seller role
  stripeOnboardingDone:  boolean
  createdAt:             ISODate
}

Category {
  id:    string
  name:  string
  slug:  string
}

Product {
  id:              ProductId
  sellerId:        UserId
  categoryId:      string
  title:           string
  description:     string
  pricesCents:     Money
  shippingCents:   Money
  stockQuantity:   number   // non-negative integer
  imageUrl:        string
  published:       boolean
  searchVector:    string   // tsvector, maintained by DB trigger
  createdAt:       ISODate
  updatedAt:       ISODate
}

CartItem {
  id:                 string
  userId:             UserId
  productId:          ProductId
  quantity:           number
  snapshotPriceCents: Money   // price at time of add
  addedAt:            ISODate
}

Order {
  id:                OrderId
  buyerId:           UserId
  sellerId:          UserId
  status:            OrderStatus
  totalCents:        Money
  shippingName:      string
  shippingLine1:     string
  shippingCity:      string
  shippingState:     string
  shippingPostal:    string
  shippingCountry:   string   // ISO 3166-1 alpha-2
  stripePaymentIntentId: string
  trackingNumber:    string | null
  createdAt:         ISODate
  updatedAt:         ISODate
}

OrderItem {
  id:             string
  orderId:        OrderId
  productId:      ProductId
  quantity:       number
  unitPriceCents: Money
}

PasswordResetToken {
  id:        string
  userId:    UserId
  tokenHash: string
  expiresAt: ISODate
  usedAt:    ISODate | null
}

ProcessedWebhookEvent {
  stripeEventId: string
  processedAt:   ISODate
}

OrderStatus = "pending_payment" | "paid" | "shipped" | "delivered" | "cancelled"
```

### Outputs — Drizzle Query Builders

Each module imports the Drizzle `db` instance and the table references it needs. The `db` instance is initialised once at application startup with the PostgreSQL connection string from environment variables.

### Inputs — Migrations

New tables or column changes are delivered as timestamped migration files under `src/db/migrations/`. Migrations are applied in order; they are never edited after being committed.

---

## Internal Invariants

- `pricesCents` and `shippingCents` on `Product` are stored as `integer NOT NULL` — the DB rejects non-integer values at the column level.
- `stockQuantity` has a `CHECK (stock_quantity >= 0)` constraint.
- `email` on `User` has a `UNIQUE` index.
- `searchVector` is populated and updated by a PostgreSQL trigger on `INSERT` / `UPDATE` of `products`.
- `ProcessedWebhookEvent.stripeEventId` has a `UNIQUE` index to support idempotent webhook processing.
- `OrderStatus` transitions are NOT enforced at the DB level — the `orders` module enforces them in code.

---

## Explicit Non-Responsibilities

- Does not contain queries or business logic.
- Does not seed category rows — that is a separate numbered seed migration.
- Does not validate money values beyond the column type — modules validate before writing.
- Does not define API request/response shapes — those belong in `api/openapi.yaml`.
