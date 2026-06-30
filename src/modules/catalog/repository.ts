import { and, eq, lt, or, sql } from 'drizzle-orm'
import { db } from '../../lib/db'
import { categories, products } from '../../db/schema'
import type { AdminListParams, BrowseParams, PageCursor, ProductPage, ProductRow, SellerListParams } from './types'

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

export function encodeCursor(row: Pick<ProductRow, 'createdAt' | 'id'>): string {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id })).toString('base64url')
}

export function parseCursor(raw: string): PageCursor {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString()) as PageCursor
  } catch {
    throw new Error('Invalid cursor')
  }
}

// Builds the WHERE fragment for (createdAt DESC, id DESC) keyset pagination.
function cursorCondition(cursor: PageCursor) {
  const ts = new Date(cursor.createdAt)
  return or(
    lt(products.createdAt, ts),
    and(eq(products.createdAt, ts), lt(products.id, cursor.id)),
  )
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function findAllCategories() {
  return db.select().from(categories)
}

// ---------------------------------------------------------------------------
// Products — public browse
// ---------------------------------------------------------------------------

export async function browseProducts(params: BrowseParams): Promise<ProductPage> {
  const { q, categoryId, cursor, limit } = params

  const conditions = [eq(products.published, true)]

  if (categoryId) conditions.push(eq(products.categoryId, categoryId))

  if (q) {
    conditions.push(
      sql`${products.searchVector} @@ websearch_to_tsquery('english', ${q})`,
    )
  }

  if (cursor) {
    const cc = cursorCondition(cursor)
    if (cc) conditions.push(cc)
  }

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(sql`${products.createdAt} DESC, ${products.id} DESC`)
    .limit(limit + 1)

  return buildPage(rows, limit)
}

// ---------------------------------------------------------------------------
// Products — single lookup
// ---------------------------------------------------------------------------

export async function findProductById(id: string): Promise<ProductRow | null> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1)
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Products — create / update / delete
// ---------------------------------------------------------------------------

export async function createProduct(data: {
  sellerId: string
  categoryId: string
  title: string
  description: string
  priceCents: number
  shippingCents: number
  stockQuantity: number
  imageUrl: string
}): Promise<ProductRow> {
  const rows = await db
    .insert(products)
    .values({ ...data, published: false })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('createProduct: insert returned no rows')
  return row
}

export async function updateProduct(
  id: string,
  changes: Partial<
    Pick<ProductRow, 'title' | 'description' | 'priceCents' | 'shippingCents' | 'categoryId' | 'stockQuantity' | 'imageUrl'>
  >,
): Promise<ProductRow> {
  const rows = await db
    .update(products)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error(`updateProduct: no row for id ${id}`)
  return row
}

export async function setProductPublished(id: string, published: boolean): Promise<ProductRow> {
  const rows = await db
    .update(products)
    .set({ published, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error(`setProductPublished: no row for id ${id}`)
  return row
}

export async function deleteProduct(id: string): Promise<void> {
  await db.delete(products).where(eq(products.id, id))
}

// ---------------------------------------------------------------------------
// Products — seller list
// ---------------------------------------------------------------------------

export async function listProductsBySeller(sellerId: string, params: SellerListParams): Promise<ProductPage> {
  const { cursor, limit } = params

  const conditions = [eq(products.sellerId, sellerId)]
  if (cursor) {
    const cc = cursorCondition(cursor)
    if (cc) conditions.push(cc)
  }

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(sql`${products.createdAt} DESC, ${products.id} DESC`)
    .limit(limit + 1)

  return buildPage(rows, limit)
}

// ---------------------------------------------------------------------------
// Products — admin list
// ---------------------------------------------------------------------------

export async function listProductsAdmin(params: AdminListParams): Promise<ProductPage> {
  const { q, status, cursor, limit } = params

  const conditions: ReturnType<typeof eq>[] = []

  if (status === 'published') conditions.push(eq(products.published, true))
  else if (status === 'unpublished') conditions.push(eq(products.published, false))

  if (q) {
    conditions.push(
      sql`${products.searchVector} @@ websearch_to_tsquery('english', ${q})`,
    )
  }

  if (cursor) {
    const cc = cursorCondition(cursor)
    if (cc) conditions.push(cc as ReturnType<typeof eq>)
  }

  const rows = await db
    .select()
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${products.createdAt} DESC, ${products.id} DESC`)
    .limit(limit + 1)

  return buildPage(rows, limit)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPage(rows: ProductRow[], limit: number): ProductPage {
  if (rows.length > limit) {
    const items = rows.slice(0, limit)
    const last = items[items.length - 1]!
    return { items, nextCursor: encodeCursor(last) }
  }
  return { items: rows }
}
