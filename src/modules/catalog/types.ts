import type { categories, products } from '../../db/schema'

export type ProductRow = typeof products.$inferSelect
export type NewProductRow = typeof products.$inferInsert
export type CategoryRow = typeof categories.$inferSelect

// Cursor encodes (createdAt, id) for stable (createdAt DESC, id DESC) pagination.
// Transmitted as an opaque base64url-encoded JSON string.
export type PageCursor = { createdAt: string; id: string }

export type BrowseParams = {
  q?: string
  categoryId?: string
  cursor?: PageCursor
  limit: number
}

export type SellerListParams = {
  cursor?: PageCursor
  limit: number
}

export type AdminListParams = {
  q?: string
  status?: 'all' | 'published' | 'unpublished'
  cursor?: PageCursor
  limit: number
}

export type ProductPage = {
  items: ProductRow[]
  nextCursor?: string
}
