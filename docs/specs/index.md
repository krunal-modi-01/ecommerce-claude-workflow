# Marketplace MVP — Feature Decomposition

**Status:** Draft  
**Version:** 0.1  
**Date:** 2026-06-29  
**Derived from:** `docs/prd/mvp.md`

---

## What this document is

Each unit in this decomposition has its own spec in this directory. A unit's spec describes its responsibility and its interface (inputs and outputs) completely enough that an engineer can implement it without reading any other unit's internals. All cross-unit calls go through the published interface listed in the target unit's spec.

---

## Units and Dependency Tiers

| Tier | Unit | Can build in parallel with |
|------|------|---------------------------|
| 0 | [db-schema](db-schema.md) | stripe-adapter, email-service |
| 0 | [stripe-adapter](stripe-adapter.md) | db-schema, email-service |
| 0 | [email-service](email-service.md) | db-schema, stripe-adapter |
| 1 | [identity](identity.md) | nothing at this tier |
| 2 | [catalog](catalog.md) | orders |
| 2 | [orders](orders.md) | catalog |
| 3 | [cart](cart.md) | nothing at this tier |
| 4 | [checkout](checkout.md) | nothing at this tier |
| 5 | [web](web.md) | admin |
| 5 | [admin](admin.md) | web |

**Rule:** a unit may only be started once all units it depends on are complete. Units at the same tier have no dependency on each other and can be developed concurrently.

---

## Dependency Graph

```
db-schema ──────────────────────────────────┐
stripe-adapter ───────────────┐             │
email-service ────────────────┤             │
                              ▼             ▼
                           identity ──► catalog ──► cart ──► checkout
                              │                               ▲
                              └──────────► orders ────────────┘
                                                              │
                                                    ┌─────────┘
                                                    ▼
                                             web     admin
```

---

## File Index

| File | Unit | Tier |
|------|------|------|
| [db-schema.md](db-schema.md) | Database schema and types | 0 |
| [stripe-adapter.md](stripe-adapter.md) | Stripe SDK wrapper | 0 |
| [email-service.md](email-service.md) | Transactional email | 0 |
| [identity.md](identity.md) | Auth, users, JWT, middleware | 1 |
| [catalog.md](catalog.md) | Product lifecycle and search | 2 |
| [orders.md](orders.md) | Order records and status | 2 |
| [cart.md](cart.md) | Shopping cart | 3 |
| [checkout.md](checkout.md) | Payment orchestration | 4 |
| [web.md](web.md) | Buyer/seller frontend | 5 |
| [admin.md](admin.md) | Admin frontend | 5 |

---

## Shared Type Conventions

All units follow these conventions for types used across spec files:

```
UserId      string (UUID)
ProductId   string (UUID)
OrderId     string (UUID)
CartId      string (UUID)
Role        "buyer" | "seller" | "admin"
Money       number  (integer cents, never float)
ISODate     string  (ISO 8601)
Cursor      string  (opaque pagination token)
```

All money values are integer cents throughout. No unit accepts or returns floats for prices, totals, or amounts.
