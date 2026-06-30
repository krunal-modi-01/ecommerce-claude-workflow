import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors'
import { getProduct } from '../catalog'
import * as repo from './repository'
import type { Cart, CartForCheckout, CartItemWithProduct, CartLineItem } from './types'

function assembleCart(userId: string, rows: CartItemWithProduct[]): Cart {
  if (rows.length === 0) {
    return { userId, sellerId: null, items: [], totalCents: 0 }
  }
  const sellerId = rows[0]!.productSellerId
  const items: CartLineItem[] = rows.map((row) => {
    const lineTotalCents = (row.snapshotPriceCents + row.shippingCents) * row.quantity
    return {
      productId: row.productId,
      productTitle: row.productTitle,
      quantity: row.quantity,
      snapshotPriceCents: row.snapshotPriceCents,
      shippingCents: row.shippingCents,
      lineTotalCents,
    }
  })
  const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0)
  return { userId, sellerId, items, totalCents }
}

export async function getCart(userId: string): Promise<Cart> {
  const rows = await repo.findCartItemsByUserId(userId)
  return assembleCart(userId, rows)
}

export async function addItem(userId: string, productId: string, quantity: number): Promise<Cart> {
  const product = await getProduct(productId)

  if (product.stockQuantity === 0) {
    throw new ConflictError('Product is out of stock.')
  }

  const rows = await repo.findCartItemsByUserId(userId)

  if (rows.length > 0 && rows[0]!.productSellerId !== product.sellerId) {
    throw new ConflictError(
      'Your cart already contains items from a different seller. Clear your cart to add items from this seller.',
    )
  }

  const existing = rows.find((r) => r.productId === productId)
  if (existing) {
    await repo.incrementCartItemQuantity(userId, productId, quantity)
  } else {
    await repo.insertCartItem({ userId, productId, quantity, snapshotPriceCents: product.priceCents })
  }

  const updated = await repo.findCartItemsByUserId(userId)
  return assembleCart(userId, updated)
}

export async function updateItem(userId: string, productId: string, quantity: number): Promise<Cart> {
  const row = await repo.setCartItemQuantity(userId, productId, quantity)
  if (!row) throw new NotFoundError('Product not found in cart.')

  const updated = await repo.findCartItemsByUserId(userId)
  return assembleCart(userId, updated)
}

export async function removeItem(userId: string, productId: string): Promise<Cart> {
  const row = await repo.deleteCartItem(userId, productId)
  if (!row) throw new NotFoundError('Product not found in cart.')

  const updated = await repo.findCartItemsByUserId(userId)
  return assembleCart(userId, updated)
}

export async function getCartForCheckout(userId: string): Promise<CartForCheckout> {
  const cart = await getCart(userId)
  if (!cart.sellerId) throw new ValidationError('Cart is empty.')
  return cart as CartForCheckout
}

export async function clearCart(userId: string): Promise<void> {
  await repo.deleteAllCartItems(userId)
}
