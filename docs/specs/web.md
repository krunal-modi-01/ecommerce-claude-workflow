# web

**Tier:** 5  
**Parallelizable with:** admin  
**Depends on:** identity, catalog, cart, checkout, orders (all via REST API)  
**Consumed by:** end users (buyers, sellers)

---

## Responsibility

The buyer- and seller-facing single-page application. Built with React 18 + Vite. Communicates exclusively with the backend REST API — no direct database access. Responsible for all buyer flows (browse, search, cart, checkout, order history) and all seller flows (product management, seller dashboard, order fulfilment).

All authentication state is managed via the `auth_token` httpOnly cookie; the frontend never handles or stores the JWT directly.

---

## Interface

### API Endpoints Consumed

The full API contract is defined in `api/openapi.yaml`. This spec lists consumed endpoints by page.

#### Public (no auth required)
| Endpoint | Used on |
|----------|---------|
| `GET /products` | Product listing page |
| `GET /products?q=&categoryId=&cursor=` | Search / filter |
| `GET /products/:id` | Product detail page |
| `GET /categories` | Category filter sidebar |

#### Buyer (requires authenticated `buyer` session)
| Endpoint | Used on |
|----------|---------|
| `POST /auth/register/buyer` | Registration page |
| `POST /auth/login` | Login page |
| `POST /auth/logout` | Any page (nav) |
| `GET /me` | Profile page |
| `PATCH /me` | Edit profile page |
| `POST /auth/password-reset/request` | Forgot password page |
| `POST /auth/password-reset/confirm` | Reset password page |
| `GET /cart` | Cart page |
| `POST /cart/items` | Product detail (add to cart) |
| `PATCH /cart/items/:productId` | Cart page (qty update) |
| `DELETE /cart/items/:productId` | Cart page (remove) |
| `POST /checkout` | Checkout page (initiate) |
| `GET /orders` | Order history page |
| `GET /orders/:id` | Order detail page |

#### Seller (requires authenticated `seller` session)
| Endpoint | Used on |
|----------|---------|
| `POST /auth/register/seller` | Seller registration page |
| `GET /seller/products` | Seller dashboard |
| `POST /products` | New product page |
| `PATCH /products/:id` | Edit product page |
| `PATCH /products/:id/published` | Seller dashboard (publish toggle) |
| `GET /seller/orders` | Seller order list |
| `PATCH /orders/:id/ship` | Seller order detail (mark shipped) |

### Pages

| Page | Route | Auth |
|------|-------|------|
| Product listing | `/` | Public |
| Product detail | `/products/:id` | Public |
| Login | `/login` | Public |
| Register (buyer) | `/register` | Public |
| Register (seller) | `/register/seller` | Public |
| Forgot / reset password | `/forgot-password`, `/reset-password` | Public |
| Cart | `/cart` | Buyer |
| Checkout | `/checkout` | Buyer |
| Order history | `/orders` | Buyer |
| Order detail | `/orders/:id` | Buyer |
| Profile | `/profile` | Buyer or Seller |
| Seller dashboard | `/seller/products` | Seller |
| New / edit product | `/seller/products/new`, `/seller/products/:id/edit` | Seller |
| Seller orders | `/seller/orders` | Seller |

### Inputs

- User interactions (clicks, form submissions)
- Stripe.js `clientSecret` received from `POST /checkout` response — used to render Stripe's payment element and confirm payment in-browser

### Outputs

- REST API calls for all data mutations and reads
- Stripe.js `stripe.confirmPayment()` call using the `clientSecret`

---

## Internal Invariants

- Every page in the Pages table above **except** the standalone auth pages (`/login`, `/register`, `/register/seller`, `/forgot-password`, `/reset-password`) must be rendered as a child route inside the `<AppShell>` layout route (`web/src/components/layout/AppShell.tsx`). The AppShell header must be visible on every such page and must show the current user's display name, role badge, and logout control.
- The app never constructs, reads, or forwards the JWT. Cookie handling is entirely browser-native.
- Money values are displayed as formatted currency strings (e.g., `$12.99`), but all values passed to the API are integer cents.
- The seller registration flow must redirect the user to the `connectOnboardingUrl` returned by the API immediately after account creation.
- Checkout page uses Stripe.js (loaded from Stripe's CDN) for the payment element — no card details pass through the platform's own JS or server.

---

## Explicit Non-Responsibilities

- Does not contain admin UI — that is the `admin` app.
- Does not compute totals or prices — all monetary computations happen server-side.
- Does not directly read from the database.
- Does not manage JWT token storage or refresh.
