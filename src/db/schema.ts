import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  customType,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Custom type for PostgreSQL tsvector (not natively modelled by Drizzle)
// ---------------------------------------------------------------------------
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const roleEnum = pgEnum('role', ['buyer', 'seller', 'admin'])

export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
])

// ---------------------------------------------------------------------------
// users
// Access patterns:
//   - login: WHERE email = $1   → uniqueIndex on email
//   - middleware / profile: WHERE id = $1  → primary key
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: roleEnum('role').notNull(),
    stripeAccountId: text('stripe_account_id'),
    stripeOnboardingDone: boolean('stripe_onboarding_done').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
)

// ---------------------------------------------------------------------------
// categories — small seeded lookup table; no extra indexes needed
// ---------------------------------------------------------------------------
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
})

// ---------------------------------------------------------------------------
// products — read-heavy; all catalog access patterns land here
//
// Index strategy (see docs/adr for rationale):
//   1. GIN on search_vector          → full-text @@ websearch_to_tsquery()
//   2. (published, created_at DESC, id DESC)
//                                    → browse: published=true, cursor pagination
//   3. (published, category_id, created_at DESC, id DESC)
//                                    → browse + category filter
//   4. (seller_id, created_at DESC)  → seller's own product list
//
// search_vector is maintained by a DB trigger (see migration).
// DB-level constraints enforce money and stock invariants.
// ---------------------------------------------------------------------------
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => users.id),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    priceCents: integer('price_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull(),
    stockQuantity: integer('stock_quantity').notNull(),
    imageUrl: text('image_url').notNull().default(''),
    published: boolean('published').notNull().default(false),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Full-text search (GIN is the correct index type for tsvector)
    index('products_search_vector_idx').using('gin', t.searchVector),
    // Browse: published + cursor pagination (no category filter)
    index('products_published_created_idx').on(t.published, t.createdAt, t.id),
    // Browse: published + category + cursor pagination
    index('products_published_category_created_idx').on(t.published, t.categoryId, t.createdAt, t.id),
    // Seller's own product management
    index('products_seller_created_idx').on(t.sellerId, t.createdAt),
    // DB-level money and stock invariants (mirrors CLAUDE.md invariants)
    check('products_price_positive', sql`price_cents > 0`),
    check('products_shipping_nonneg', sql`shipping_cents >= 0`),
    check('products_stock_nonneg', sql`stock_quantity >= 0`),
  ],
)

// ---------------------------------------------------------------------------
// cart_items
// Access patterns:
//   - getCart / addItem / removeItem: WHERE user_id = $1
//   - prevent duplicate product in cart: (user_id, product_id) must be unique
// The unique index on (user_id, product_id) also covers the user_id lookup.
// ---------------------------------------------------------------------------
export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    snapshotPriceCents: integer('snapshot_price_cents').notNull(),
    addedAt: timestamp('added_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cart_items_user_product_idx').on(t.userId, t.productId),
    check('cart_items_qty_positive', sql`quantity >= 1`),
  ],
)

// ---------------------------------------------------------------------------
// orders — write-heavy on creation; read by buyer, seller, and admin separately
//
// Index strategy:
//   1. (buyer_id, created_at DESC)               → getOrdersByBuyer
//   2. (seller_id, created_at DESC)              → getOrdersBySeller
//   3. (created_at DESC)                         → getAllOrders (admin)
//   4. uniqueIndex on stripe_payment_intent_id   → idempotency check
// ---------------------------------------------------------------------------
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => users.id),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum('status').notNull().default('pending_payment'),
    totalCents: integer('total_cents').notNull(),
    shippingName: text('shipping_name').notNull(),
    shippingLine1: text('shipping_line1').notNull(),
    shippingCity: text('shipping_city').notNull(),
    shippingState: text('shipping_state').notNull(),
    shippingPostal: text('shipping_postal').notNull(),
    shippingCountry: text('shipping_country').notNull(),
    stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),
    trackingNumber: text('tracking_number'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('orders_buyer_created_idx').on(t.buyerId, t.createdAt),
    index('orders_seller_created_idx').on(t.sellerId, t.createdAt),
    index('orders_created_idx').on(t.createdAt),
    uniqueIndex('orders_stripe_intent_idx').on(t.stripePaymentIntentId),
    check('orders_total_positive', sql`total_cents > 0`),
  ],
)

// ---------------------------------------------------------------------------
// order_items
// Access pattern: always WHERE order_id = $1
// ---------------------------------------------------------------------------
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_qty_positive', sql`quantity >= 1`),
    check('order_items_price_positive', sql`unit_price_cents > 0`),
  ],
)

// ---------------------------------------------------------------------------
// password_reset_tokens
// Access pattern: lookup by token_hash to validate a reset request
// ---------------------------------------------------------------------------
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
  },
  (t) => [index('prt_token_hash_idx').on(t.tokenHash)],
)

// ---------------------------------------------------------------------------
// processed_webhook_events
// stripe_event_id is the primary key — uniqueness is the entire point.
// Point-lookup for idempotency check on every webhook.
// ---------------------------------------------------------------------------
export const processedWebhookEvents = pgTable('processed_webhook_events', {
  stripeEventId: text('stripe_event_id').primaryKey(),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Exported row types (used by every module)
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Category = typeof categories.$inferSelect
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type CartItem = typeof cartItems.$inferSelect
export type NewCartItem = typeof cartItems.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect
