# Marketplace MVP — Product Requirements Document

**Status:** Draft  
**Version:** 0.1  
**Date:** 2026-06-29  
**Author:** Krunal Modi

---

## Problem Statement

Small independent sellers have no lightweight platform to list products and reach buyers without paying the high fees and competing with millions of SKUs on large incumbents. Buyers, in turn, lack a focused marketplace with a straightforward discovery and checkout experience. This MVP establishes the minimum viable multi-vendor marketplace: sellers can list products, buyers can discover and purchase them, payments route correctly to sellers via Stripe Connect, and a minimal admin surface keeps content quality in check.

## Success Metrics

1. A seller can register, complete Stripe Connect onboarding, and publish a product within 10 minutes of first visit.
2. A buyer can find a product via search, add to cart, and complete payment in under 3 minutes.
3. Zero instances of a price being accepted from the client (all totals computed server-side).
4. Payment webhook processed idempotently — duplicate Stripe events produce no duplicate orders.
5. Admin can unpublish a violating product within 2 clicks of viewing the product list.

---

## Assumptions

The following assumptions were made to keep v1 small. Each is marked **[ASSUMPTION]** inline where it affects a feature.

| # | Assumption |
|---|------------|
| A1 | Stripe Connect (Express accounts) is used for seller payouts. The platform takes no fee cut in v1. |
| A2 | No manual approval gate on new sellers — they self-onboard via Stripe Connect. |
| A3 | Product images are stored as URLs (external host or pre-signed S3). No in-app file upload UI in v1. |
| A4 | Buyers see their own orders; sellers see orders containing their products; admins see all orders. |
| A5 | Inventory is a simple integer stock count. No reserved-stock or backorder logic. |
| A6 | Shipping cost is a flat integer (cents) set per product by the seller. No carrier integration. |
| A7 | Categories are a fixed seeded list. No dynamic category management in v1. |
| A8 | Users hold exactly one role (`buyer`, `seller`, or `admin`) set at registration. Role change is not supported in v1. |
| A9 | Cart is server-side, tied to authenticated user. Guest cart is not supported. |
| A10 | v1 checkout is single-seller per order. A cart with items from multiple sellers requires separate checkouts per seller. This simplifies Stripe Connect transfer routing; multi-seller cart is a v2 item. |

---

## Feature 1: Account Authentication

**Module:** `identity`

### User Stories

| ID | Story |
|----|-------|
| AUTH-1 | As a visitor, I can register as a buyer with my email and a password so that I can browse and purchase products. |
| AUTH-2 | As a visitor, I can register as a seller so that I can list products for sale. Registering as a seller initiates Stripe Connect onboarding. **[A1, A2]** |
| AUTH-3 | As a registered user, I can log in with my email and password and receive an authenticated session. |
| AUTH-4 | As a logged-in user, I can log out and have my session invalidated. |
| AUTH-5 | As a logged-in user, I can view and update my display name and email address. |
| AUTH-6 | As a registered user who has forgotten their password, I can request a reset link sent to my email. |

### Acceptance Criteria

- Passwords hashed server-side with bcrypt at ≥ 12 cost rounds before storage.
- JWT issued on login and stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie. The token is never present in a response body or accessible to JavaScript.
- On seller registration: server generates a Stripe Connect Express onboarding URL and returns it to the client. Seller cannot publish products until Stripe Connect onboarding is complete. **[A1, A2]**
- Email address must be unique; duplicate registration returns HTTP 409.
- Password reset token is a cryptographically random string, stored hashed, valid for 24 hours, and invalidated after first use.
- Profile update (display name, email) requires re-authentication (current password confirmation) when changing email.

### Non-Goals

- OAuth / SSO (Google, GitHub, etc.)
- Two-factor authentication
- Phone number verification
- Changing role after registration (buyer cannot become a seller in v1) **[A8]**
- Session revocation list / multi-device logout

---

## Feature 2: Product Catalog with Search

**Module:** `catalog`

### User Stories

| ID | Story |
|----|-------|
| CAT-1 | As a buyer, I can browse a paginated list of published products so that I can discover what is available. |
| CAT-2 | As a buyer, I can search products by keyword so that I can find specific items quickly. |
| CAT-3 | As a buyer, I can filter products by category so that I can narrow my browsing. |
| CAT-4 | As a buyer, I can view a product detail page showing title, description, price, seller name, stock, and image. |
| CAT-5 | As a seller, I can create a new product listing with all required fields. |
| CAT-6 | As a seller, I can edit any field of my own product. |
| CAT-7 | As a seller, I can unpublish a product to hide it from buyers without deleting it. |

### Acceptance Criteria

- Full-text search is implemented via PostgreSQL `tsvector` over the product `title` and `description` columns, ranked by `ts_rank`. **[A7]**
- Category filter is applied as an `AND` condition with any active search query.
- Listing endpoint uses cursor-based pagination; default page size is 20.
- Only published products are visible to buyers. Unpublished products remain visible to their owner (seller) and to admins.
- Price and shipping cost are stored as integer cents. The server rejects any request that provides a price as a non-integer or as a float. **[A6]**
- A product cannot be published unless it has at least one image URL set. **[A3]**
- A product cannot be published unless the seller has completed Stripe Connect onboarding. **[A1, A2]**
- Stock quantity is a non-negative integer. Setting it to 0 does not auto-unpublish the product but prevents it from being added to a cart. **[A5]**

### Non-Goals

- External search engines (Elasticsearch, Typesense, Algolia)
- Faceted or attribute-based filtering (size, colour, brand)
- Seller-managed category creation or editing **[A7]**
- Bulk product import (CSV or API)
- Product variants or SKUs
- Product reviews and ratings
- In-app image upload **[A3]**

---

## Feature 3: Shopping Cart

**Module:** `cart`

### User Stories

| ID | Story |
|----|-------|
| CART-1 | As an authenticated buyer, I can add a product to my cart with a chosen quantity. |
| CART-2 | As a buyer, I can update the quantity of an item in my cart. |
| CART-3 | As a buyer, I can remove an item from my cart. |
| CART-4 | As a buyer, I can view my cart showing each line item, unit price, quantity, line total, and the overall cart total. |
| CART-5 | As a buyer, my cart persists across browser sessions so I do not lose items on logout or revisit. |

### Acceptance Criteria

- Cart is stored server-side, keyed to the authenticated user's ID. **[A9]**
- Adding a product that has `stock = 0` returns HTTP 409 with a clear error message. **[A5]**
- Each cart line item records a price snapshot (the price at time of add). The buyer sees the price they originally added, even if the seller later changes the price. The snapshot does not prevent purchase if the current price differs.
- Cart total = Σ (snapshot_price × quantity) + Σ (shipping_cost × quantity) — computed server-side on every cart read. The client never sends a total. **[A6]**
- Cart is automatically cleared when an order is successfully created from it.
- A cart may only contain products from a single seller at a time. Adding a product from a different seller than the current cart contents returns HTTP 409 with a message indicating the conflict. **[A10]**

### Non-Goals

- Guest (unauthenticated) cart **[A9]**
- Saved-for-later / wishlist
- Multi-currency pricing
- Cart sharing or gifting
- Promo code or discount application (belongs to checkout)

---

## Feature 4: Checkout with Stripe

**Module:** `checkout`

### User Stories

| ID | Story |
|----|-------|
| CHK-1 | As a buyer, I can proceed from my cart to a checkout flow. |
| CHK-2 | As a buyer, I can enter a shipping address during checkout. |
| CHK-3 | As a buyer, I can pay by card via Stripe and have my payment processed securely. |
| CHK-4 | As a buyer, I receive an order confirmation (on-screen and by email) after a successful payment. |
| CHK-5 | As a seller, my Stripe Connect account receives the funds after a buyer successfully pays for my products. **[A1]** |

### Acceptance Criteria

- Stripe Payment Intent is created server-side with `amount` in integer cents. The client receives only a `client_secret` to complete payment in the browser; the server never accepts an amount from the client. **[A1]**
- Stripe Connect transfer to the seller's connected account is triggered by the `payment_intent.succeeded` webhook event. **[A1, A10]**
- Required shipping address fields: full name, address line 1, city, state/province, postal code, country (ISO 3166-1 alpha-2).
- On successful webhook confirmation: order record is persisted, cart is cleared, and a confirmation email is queued for the buyer.
- Webhook events are processed at-most-once using the Stripe event ID as an idempotency key. Replayed events are acknowledged with HTTP 200 and produce no side effects.
- A failed or declined payment surfaces the Stripe error code/message to the buyer. The cart is preserved so the buyer can retry.
- Checkout is blocked if the cart is empty or if the seller has not completed Stripe Connect onboarding. **[A2, A10]**

> **[A10] Single-seller constraint:** Each checkout processes items from exactly one seller. The cart enforces this at add-time (see Feature 3). Multi-seller cart checkout is explicitly out of scope for v1.

### Non-Goals

- Payment methods other than card (wallets, bank transfers, buy-now-pay-later)
- Saved payment methods / one-click reorder
- Coupon or promotional code support
- Tax calculation or collection
- Platform fee / revenue split in v1 **[A1]**
- Refund or dispute initiation from the platform

---

## Feature 5: Order History

**Module:** `orders`

### User Stories

| ID | Story |
|----|-------|
| ORD-1 | As a buyer, I can view a paginated list of my past orders showing date, seller, total, and status. |
| ORD-2 | As a buyer, I can view the detail of an order showing line items, shipping address, and payment status. |
| ORD-3 | As a seller, I can view a paginated list of orders that contain my products. |
| ORD-4 | As a seller, I can mark an order as shipped and optionally record a tracking number. |

### Acceptance Criteria

- Order lifecycle statuses (in order): `pending_payment` → `paid` → `shipped` → `delivered` → `cancelled`. Status transitions are enforced server-side; the client cannot set an arbitrary status.
- Buyer order list is sorted by `created_at` descending, paginated at 20 per page.
- Seller order view is scoped strictly to orders containing their own products. The seller cannot see any information about the buyer's other orders or other sellers' line items. **[A4]**
- Admin can view all orders without restriction. **[A4]**
- Tracking number is a free-text string field (max 100 characters). No carrier validation. **[A6 analogue]**
- Marking an order as shipped transitions status from `paid` to `shipped`. Attempting this from any other status returns HTTP 409.

### Non-Goals

- Returns, refunds, or exchanges
- Buyer-initiated cancellation
- Dispute / chargeback handling
- Delivery confirmation (status `delivered` is set manually by seller in v1)
- Push notifications or SMS for status changes
- Carrier API integration for tracking

---

## Feature 6: Minimal Admin

**App:** separate Vite application (`/admin`)

### User Stories

| ID | Story |
|----|-------|
| ADM-1 | As an admin, I can log in to the admin application using my admin credentials. |
| ADM-2 | As an admin, I can view a searchable, filterable list of all products across all sellers. |
| ADM-3 | As an admin, I can unpublish any product to hide it from buyers. |
| ADM-4 | As an admin, I can permanently delete any product after confirming the action. |
| ADM-5 | As an admin, I can view a list of all orders and their current statuses. |
| ADM-6 | As an admin, I can view a list of all registered users (buyers and sellers) with their role and registration date. |

### Acceptance Criteria

- Admin app is a distinct Vite application (e.g. `/admin` directory at repo root). It shares the same API server as `/web`; it does not have its own backend. **[A8]**
- Every API request from the admin app is validated server-side for the `admin` role. A missing or non-admin JWT returns HTTP 403 regardless of which client sent the request.
- Product list supports free-text search by title and a filter by status (`published` / `unpublished` / `all`).
- Delete is a two-step action: the UI requires an explicit confirmation before the delete request is sent.
- Unpublish immediately changes product status to `unpublished`; it is reversible (admin can re-publish).
- Delete is permanent and irreversible.
- Admin cannot create or edit product content (that is a seller responsibility). **[A10 analogue]**
- Admin cannot impersonate users.

### Non-Goals

- Analytics or revenue dashboards
- Seller verification / KYC workflows
- Suspending or banning user accounts
- Bulk actions (bulk unpublish, bulk delete)
- Content moderation queue / flagging workflow
- Admin user management (adding/removing admin accounts is out of scope for v1)

---

## Out of Scope for v1 (Global)

The following are explicitly deferred to future versions:

- Multi-seller cart checkout **[A10]**
- Platform fee / revenue split **[A1]**
- Mobile native apps
- Internationalisation (i18n) or localisation
- Email marketing or promotional features
- Seller analytics or sales reporting
- Subscription or recurring purchase support
