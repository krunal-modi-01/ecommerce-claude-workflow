# admin

**Tier:** 5  
**Parallelizable with:** web  
**Depends on:** identity, catalog, orders (all via REST API)  
**Consumed by:** platform administrators

---

## Responsibility

The admin-only single-page application. A separate React 18 + Vite app located at `/admin` in the repository root. Communicates with the same backend REST API as `web`, using the same `auth_token` cookie mechanism, but is exclusively accessible to users with the `admin` role. Any route that is not protected by an admin-role check on the server returns HTTP 403.

Admins can view and moderate products, view all orders, and view registered users. Admins cannot create products or impersonate users.

---

## Interface

### API Endpoints Consumed

#### Auth
| Endpoint | Used on |
|----------|---------|
| `POST /auth/login` | Admin login page |
| `POST /auth/logout` | Any page (nav) |

#### Products (admin scope)
| Endpoint | Used on |
|----------|---------|
| `GET /admin/products?q=&status=&cursor=` | Product list page |
| `PATCH /products/:id/published` | Product list (unpublish/re-publish) |
| `DELETE /products/:id` | Product list (delete, after confirmation) |

#### Orders (admin scope)
| Endpoint | Used on |
|----------|---------|
| `GET /admin/orders?cursor=` | Order list page |
| `GET /orders/:id` | Order detail page |

#### Users (admin scope)
| Endpoint | Used on |
|----------|---------|
| `GET /admin/users?cursor=` | User list page |

### Pages

| Page | Route | Notes |
|------|-------|-------|
| Login | `/login` | Only page accessible without admin session |
| Product list | `/products` | Search by title; filter by status (all / published / unpublished) |
| Order list | `/orders` | All orders, all sellers |
| Order detail | `/orders/:id` | Full order view |
| User list | `/users` | Buyers and sellers; role and registration date |

### Inputs

- Admin credentials on login
- Search/filter inputs on product and order list pages
- Confirmation dialog before delete actions

### Outputs

- REST API calls for all reads and mutations
- A confirmation modal is shown before any destructive action (delete) — the API call is only made after the admin explicitly confirms

---

## Internal Invariants

- The app is deployed as a separate origin or sub-path (e.g., `admin.marketplace.com` or `/admin/`) so its routes do not conflict with `/web` routes.
- Every page except `/login` redirects to `/login` if the `auth_token` cookie is absent or the decoded role is not `"admin"`. This check is performed client-side for UX (to avoid a flash), but the server enforces it independently on every request.
- Unpublish is always reversible — the UI makes this clear (button label "Unpublish" vs "Permanently Delete").
- Delete is irreversible — the confirmation dialog explicitly states this before the user confirms.

---

## Explicit Non-Responsibilities

- Does not contain buyer or seller flows — those are in the `web` app.
- Does not allow admins to create or edit product content.
- Does not allow admins to impersonate users or take actions on their behalf.
- Does not show analytics, revenue charts, or aggregated metrics in v1.
- Does not manage other admin accounts (adding/removing admins is out of scope for v1).
- Does not compute or display money calculations — it displays server-returned values.
