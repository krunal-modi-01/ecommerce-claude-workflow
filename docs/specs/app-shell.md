# app-shell

**Tier:** 5 (frontend, same tier as web)
**Parallelizable with:** nothing (depends on all navigation targets existing)
**Depends on:** identity (AuthContext, useAuth), catalog, cart (future), orders (future)
**Consumed by:** web (App.tsx route tree)

---

## Responsibility

Provides the persistent layout chrome — header, primary navigation, and auth controls — that
wraps every non-auth page. Reads session state exclusively from the existing `AuthContext`
(`web/src/context/AuthContext.tsx`) via the `useAuth()` hook; does not own or alter auth
state. Renders a role-aware navigation set and user area so the current user is always visible
and a logout action is always reachable.

Auth pages (`/login`, `/register`, `/register/seller`, `/forgot-password`, `/reset-password`)
are **excluded** from the shell; they retain their existing standalone centered-card layouts.

---

## Component Tree

```
AppShell                     (React Router layout route — renders <Outlet />)
└── <header>
    ├── Brand                (logo mark + wordmark → navigates to /)
    ├── PrimaryNav           (role-aware navigation links)
    └── AuthControls         (three distinct states: loading | logged-in | logged-out)
<main>
    <Outlet />               (page content rendered here)
```

`AppShell` is a **React Router layout route** (renders `<Outlet />`). It is placed as a
parent `<Route element={<AppShell />}>` in `App.tsx` that wraps all shell-wrapped routes.
Auth routes live outside this parent and are unaffected.

---

## Header Layout

The header is a single horizontal bar spanning the full viewport width.

| Region | Left | Center | Right |
|---|---|---|---|
| Content | Brand | PrimaryNav (desktop) | AuthControls |

On viewports narrower than `sm` (640 px), `PrimaryNav` collapses; the Brand and AuthControls
remain visible. A mobile nav toggle is **out of scope for this spec** — mark the collapsed
state as "coming soon" with a hamburger placeholder.

**Visual spec (design-system tokens only — no raw values):**
- Header element: `bg-white border-b border-neutral-200 sticky top-0 z-10`
- Inner container: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6`
- Brand link: `text-lg font-bold text-primary-600 hover:text-primary-700 shrink-0`
- Nav links: `text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors`
- Active nav link (current route): `text-primary-600 font-semibold`
- Nav link active detection: use React Router `<NavLink>` with its `isActive` callback

---

## PrimaryNav — Navigation Links

Navigation items are role-conditional. Show only the links the current user can meaningfully
reach. The `isLoading` state from `useAuth()` suppresses nav rendering (show skeleton instead).

| Link label | Path | Visible when |
|---|---|---|
| Browse | `/` | Always (logged-in or not) |
| Cart | `/cart` | `user.role === 'buyer'` (renders even if cart module not yet wired — links to future path) |
| Orders | `/orders` | `user.role === 'buyer'` |
| My Listings | `/seller/products` | `user.role === 'seller'` |
| Admin | `/admin/products` | `user.role === 'admin'` |

"Browse" is always shown because `/` is a public catalog page. Cart and Orders links appear
for buyers even before those modules are implemented — the nav should be stable so the shell
doesn't change shape as modules are added.

---

## AuthControls — Three States

### State 1: Loading (`isLoading === true`)

Show a placeholder that matches the approximate footprint of the logged-in state so the
header doesn't reflow on hydration:

```
[Skeleton w-24 h-4 rounded] [Skeleton w-16 h-8 rounded-md]
```

Use the existing `Skeleton` component (`web/src/components/ui/Skeleton.tsx`).

### State 2: Logged in (`user !== null`)

```
[Role Badge]   [user.displayName — link to /profile]   [Logout — Button variant="ghost"]
```

- Role pill: a `Badge` with `variant="neutral"` showing the capitalised role (`Buyer` /
  `Seller` / `Admin`) immediately to the left of the display name. Always shown — makes the
  active role legible without having to infer it from which nav items are visible.
- Display name: `text-sm font-medium text-neutral-700 hover:text-neutral-900`, wraps in a
  `<Link to="/profile">` so the name is also the profile entry point. Capped at
  `max-w-[12rem] truncate` to prevent overflow on narrow screens.
- Logout: `Button` component with `variant="ghost"`, calls `useAuth().logout()` then
  navigates to `/login`. Shows `loading={true}` (Spinner) while the logout request is
  in-flight.

### State 3: Logged out (`user === null && !isLoading`)

```
[Sign in — link styled as ghost button]   [Create account — Button variant="secondary"]
```

- "Sign in" → `/login` (use `<Link>` styled with the ghost button class pattern from
  `Button.tsx`; do not use `<Button>` because it renders a `<button>`, not an `<a>`).
- "Create account" → `/register` (`Button variant="secondary"`, renders as `<Link>`).
- Buying-specific copy: these links remain unchanged regardless of whether the visitor
  would eventually register as a seller — the seller registration path is discoverable from
  the buyer registration page.

---

## Auth Wiring

The shell reads and reacts to `AuthContext` exclusively via `useAuth()`:

```typescript
const { user, isLoading, logout } = useAuth()
```

`AuthContext` is already provided at the root (`web/src/main.tsx` > `AuthProvider` wraps
`<App>`), so `AppShell` requires no new context providers. The shell must not call `login`,
`refresh`, or any identity API directly — those remain on their respective pages.

Logout sequence:
1. User clicks "Logout".
2. Shell calls `logout()` (from `useAuth`), which POSTs `/auth/logout` and clears `user`.
3. On resolution, shell calls `navigate('/login')`.
4. If `logout()` throws (network error), display a transient `Alert variant="error"` inline
   in the AuthControls area; do not navigate away.

---

## Route Wiring in `App.tsx`

The current App.tsx structure is replaced with a layout route pattern:

```
Routes
├── /login                        ← standalone (no shell)
├── /register                     ← standalone
├── /register/seller              ← standalone
├── /forgot-password              ← standalone
├── /reset-password               ← standalone
└── AppShell (layout route)       ← all remaining routes
    ├── /                         → ProductsPage (public)
    ├── /products/:id             → ProductDetailPage (public)
    ├── /profile                  → ProfilePage (ProtectedRoute)
    ├── /seller/products          → SellerProductsPage (SellerRoute)
    ├── /seller/products/new      → SellerCreateProductPage (SellerRoute)
    └── /seller/products/:id/edit → SellerEditProductPage (SellerRoute)
```

`ProtectedRoute` and `SellerRoute` remain as they are; they just move inside the layout
route. The AppShell's `<Outlet />` renders the page component selected by the child route.

---

## Design-System Conformance

All elements in the shell are built from the existing design system:

| Element | Component / token |
|---|---|
| Logout button | `Button` (`variant="ghost"`) |
| Create account link | `Button` (`variant="secondary"`) rendered as `<Link>` |
| Loading skeleton | `Skeleton` |
| Role pill | `Badge` (`variant="neutral"`) |
| Error on logout failure | `Alert` (`variant="error"`) |
| Nav active state | `NavLink` + `text-primary-600 font-semibold` |
| Brand colour | `text-primary-600` |
| Header border | `border-neutral-200` |

No raw hex values, no ad-hoc inline styles. Every interactive element exposes focus-visible
styling (inherited from Button; nav links add
`focus-visible:ring-2 focus-visible:ring-primary-500 rounded`).

---

## Internal Invariants

- The header is `sticky top-0` so it stays visible during long scrollable pages.
- `z-10` on the header keeps it above page content (cards, images) without conflicting with
  any modal/overlay (which must use `z-20+`).
- The shell never blocks rendering of its children. Both the auth check (`isLoading`) and
  any logout request are non-blocking — the `<Outlet />` renders immediately.
- Display name is truncated at `max-w-[12rem] truncate` to prevent a long name from
  overflowing into nav links on narrow screens.
- The shell does not redirect unauthenticated users. Redirection is the responsibility of
  `ProtectedRoute` / `SellerRoute` child wrappers (as today).

---

## Explicit Non-Responsibilities

- Does not implement mobile hamburger navigation (placeholder icon only; full mobile nav is
  a separate spec).
- Does not manage cart badge counts or unread-order indicators (deferred to their modules).
- Does not render a footer.
- Does not handle the Stripe Connect onboarding banner ("complete your setup to publish") —
  that is a seller-dashboard concern, not global shell state.
- Does not alter `AuthContext` or auth session mechanics in any way.
