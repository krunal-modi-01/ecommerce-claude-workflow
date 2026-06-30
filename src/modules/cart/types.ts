import type { cartItems } from '../../db/schema'

export type CartItemRow = typeof cartItems.$inferSelect
export type NewCartItemRow = typeof cartItems.$inferInsert

// JOIN result — shippingCents is always live from the products table
export type CartItemWithProduct = {
  id: string
  userId: string
  productId: string
  quantity: number
  snapshotPriceCents: number
  addedAt: Date
  productTitle: string
  shippingCents: number
  productSellerId: string
}

export type CartLineItem = {
  productId: string
  productTitle: string
  quantity: number
  snapshotPriceCents: number
  shippingCents: number
  lineTotalCents: number
}

export type Cart = {
  userId: string
  sellerId: string | null
  items: CartLineItem[]
  totalCents: number
}

// Narrowed for checkout module — sellerId is always present
export type CartForCheckout = {
  userId: string
  sellerId: string
  items: CartLineItem[]
  totalCents: number
}
