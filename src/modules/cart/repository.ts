import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../lib/db'
import { cartItems, products } from '../../db/schema'
import type { CartItemRow, CartItemWithProduct } from './types'

export async function findCartItemsByUserId(userId: string): Promise<CartItemWithProduct[]> {
  return db
    .select({
      id: cartItems.id,
      userId: cartItems.userId,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      snapshotPriceCents: cartItems.snapshotPriceCents,
      addedAt: cartItems.addedAt,
      productTitle: products.title,
      shippingCents: products.shippingCents,
      productSellerId: products.sellerId,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId))
}

export async function findCartItem(userId: string, productId: string): Promise<CartItemRow | null> {
  const rows = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .limit(1)
  return rows[0] ?? null
}

export async function insertCartItem(data: {
  userId: string
  productId: string
  quantity: number
  snapshotPriceCents: number
}): Promise<CartItemRow> {
  const rows = await db.insert(cartItems).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('insert cart item returned no rows')
  return row
}

export async function incrementCartItemQuantity(
  userId: string,
  productId: string,
  delta: number,
): Promise<CartItemRow> {
  const rows = await db
    .update(cartItems)
    .set({ quantity: sql`${cartItems.quantity} + ${delta}` })
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('increment cart item returned no rows')
  return row
}

export async function setCartItemQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartItemRow | null> {
  const rows = await db
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .returning()
  return rows[0] ?? null
}

export async function deleteCartItem(userId: string, productId: string): Promise<CartItemRow | null> {
  const rows = await db
    .delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .returning()
  return rows[0] ?? null
}

export async function deleteAllCartItems(userId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.userId, userId))
}
