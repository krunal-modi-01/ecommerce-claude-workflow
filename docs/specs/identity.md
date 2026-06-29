# identity

**Tier:** 1  
**Parallelizable with:** nothing at this tier  
**Depends on:** db-schema, stripe-adapter, email-service  
**Consumed by:** catalog, cart, orders, checkout, web, admin

---

## Responsibility

Owns all user account management: registration (buyer and seller), credential verification, JWT issuance, session management via httpOnly cookies, Stripe Connect account creation for sellers, profile updates, and password reset. Also exports the Express middleware (`requireAuth`) that every other module uses to authenticate requests and enforce role access.

---

## Interface

### Registration

```
registerBuyer(input: {
  email:       string
  password:    string
  displayName: string
}) → Promise<User>
```
Creates a `buyer`-role user. Hashes the password with bcrypt (≥ 12 rounds). Returns the created `User` row (without `passwordHash`). Throws `ConflictError` if the email is already registered.

---

```
registerSeller(input: {
  email:       string
  password:    string
  displayName: string
}) → Promise<{ user: User, connectOnboardingUrl: string }>
```
Creates a `seller`-role user. Calls `stripe-adapter.createConnectAccount()` to obtain a Stripe Express account ID, stores it on the user row, then calls `stripe-adapter.createConnectOnboardingUrl()` to generate the onboarding redirect URL. Returns both the created user and the URL for the client to redirect the seller into Stripe's onboarding flow.

---

### Session

```
login(
  input: { email: string, password: string },
  res: ExpressResponse
) → Promise<User>
```
Verifies credentials, issues a JWT (signed with `JWT_SECRET` from env), and writes it to an `httpOnly`, `Secure`, `SameSite=Strict` cookie named `auth_token`. Returns the authenticated `User`. Throws `UnauthorizedError` on bad credentials.

---

```
logout(res: ExpressResponse) → void
```
Clears the `auth_token` cookie by setting it to an expired value.

---

### Profile

```
getProfile(userId: UserId) → Promise<User>
```
Returns the user record for `userId`. Throws `NotFoundError` if the user does not exist.

---

```
updateProfile(
  userId: UserId,
  changes: { displayName?: string, email?: string },
  currentPassword: string
) → Promise<User>
```
Verifies `currentPassword` before applying changes. An email change re-checks uniqueness. Throws `UnauthorizedError` if `currentPassword` is wrong; `ConflictError` if the new email is taken.

---

### Password Reset

```
requestPasswordReset(email: string) → Promise<void>
```
Generates a cryptographically random token, stores its hash in `password_reset_tokens` with a 24-hour expiry, then calls `email-service.sendPasswordReset()`. Always returns successfully — does not reveal whether the email exists.

---

```
resetPassword(token: string, newPassword: string) → Promise<void>
```
Looks up the token hash, validates it is unexpired and unused, hashes and stores the new password, and marks the token as used. Throws `InvalidTokenError` if the token is missing, expired, or already used.

---

### Stripe Connect Status

```
getSellerConnectStatus(
  userId: UserId
) → Promise<{ onboardingComplete: boolean }>
```
Returns whether the seller has completed Stripe Connect onboarding. Calls `stripe-adapter.getConnectAccountStatus()` using the stored `stripeAccountId`. Throws `NotFoundError` if the user is not a seller.

---

### Auth Middleware

```
requireAuth(role?: Role) → ExpressMiddleware
```
Express middleware factory. When mounted on a route:
- Reads the `auth_token` cookie.
- Verifies the JWT signature and expiry using `JWT_SECRET`.
- If `role` is provided, checks that `req.user.role === role`.
- On success: attaches `req.user: User` for downstream handlers.
- On failure: responds with HTTP 401 (missing/invalid token) or HTTP 403 (wrong role).

Usage pattern in other modules:
```
router.get('/products', requireAuth(), handler)        // any authenticated user
router.post('/products', requireAuth('seller'), handler)  // sellers only
router.delete('/products/:id', requireAuth('admin'), handler)  // admins only
```

---

### Error Cases

| Condition | Error | HTTP |
|-----------|-------|------|
| Email already registered | `ConflictError` | 409 |
| Bad credentials on login | `UnauthorizedError` | 401 |
| JWT missing or invalid | `UnauthorizedError` | 401 |
| Role mismatch | `ForbiddenError` | 403 |
| User not found | `NotFoundError` | 404 |
| Token expired / used | `InvalidTokenError` | 400 |
| Wrong current password on profile update | `UnauthorizedError` | 401 |

---

## Internal Invariants

- `passwordHash` is never returned to callers — it is stripped before any `User` object leaves this module.
- JWT payload contains `{ sub: userId, role, iat, exp }`. Expiry is 7 days.
- `registerSeller` is atomic: if Stripe account creation fails, the user row is not persisted.
- `requireAuth()` without a role argument allows any authenticated role (`buyer`, `seller`, `admin`).

---

## Explicit Non-Responsibilities

- Does not manage products, carts, orders, or payments.
- Does not implement OAuth or SSO.
- Does not support role changes after registration.
- Does not maintain a session revocation list — JWT expiry is the only invalidation mechanism in v1.
