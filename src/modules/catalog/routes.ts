import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { ValidationError } from '../../lib/errors'
import { requireAuth } from '../identity'
import * as service from './service'
import { parseCursor } from './repository'

const router = Router()

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

function validate<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const detail = result.error.errors.map((e) => e.message).join('; ')
    throw new ValidationError(detail)
  }
  return result.data as z.infer<S>
}

const limitSchema = z.coerce.number().int().min(1).max(100).default(20)

function parsePageParams(query: Record<string, unknown>) {
  const limit = limitSchema.parse(query.limit)
  const cursorRaw = typeof query.cursor === 'string' ? query.cursor : undefined
  const cursor = cursorRaw ? parseCursor(cursorRaw) : undefined
  return { limit, cursor }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().min(1, 'Description is required.'),
  priceCents: z.number().int().positive('Price must be a positive integer (cents).'),
  shippingCents: z.number().int().min(0, 'Shipping cents must be non-negative.'),
  categoryId: z.string().min(1, 'Category is required.'),
  stockQuantity: z.number().int().min(0, 'Stock quantity must be non-negative.'),
  imageUrl: z.string().default(''),
})

const updateProductSchema = createProductSchema.partial()

const setPublishedSchema = z.object({
  published: z.boolean(),
})

// ---------------------------------------------------------------------------
// GET /categories
// ---------------------------------------------------------------------------

router.get('/categories', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await service.listCategories()
    res.json(categories)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /products
// ---------------------------------------------------------------------------

router.get('/products', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit, cursor } = parsePageParams(req.query as Record<string, unknown>)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() || undefined : undefined
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined
    const page = await service.listProducts({ q, categoryId, cursor, limit })
    res.json(page)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /products/:id
// ---------------------------------------------------------------------------

router.get('/products/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await service.getProduct(req.params['id'] as string, req.user)
    res.json(product)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /products — seller only
// ---------------------------------------------------------------------------

router.post(
  '/products',
  requireAuth('seller'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = validate(createProductSchema, req.body)
      const product = await service.createProduct(req.user!.id, input)
      res.status(201).json(product)
    } catch (err) {
      next(err)
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /products/:id — owning seller
// ---------------------------------------------------------------------------

router.patch(
  '/products/:id',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const changes = validate(updateProductSchema, req.body)
      const product = await service.updateProduct(req.params['id'] as string, req.user!.id, changes)
      res.json(product)
    } catch (err) {
      next(err)
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /products/:id — admin only
// ---------------------------------------------------------------------------

router.delete(
  '/products/:id',
  requireAuth('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await service.deleteProduct(req.params['id'] as string)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /products/:id/published — owning seller or admin
// ---------------------------------------------------------------------------

router.patch(
  '/products/:id/published',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { published } = validate(setPublishedSchema, req.body)
      const product = await service.setPublished(req.params['id'] as string, req.user!, published)
      res.json(product)
    } catch (err) {
      next(err)
    }
  },
)

// ---------------------------------------------------------------------------
// GET /seller/products — seller only
// ---------------------------------------------------------------------------

router.get(
  '/seller/products',
  requireAuth('seller'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePageParams(req.query as Record<string, unknown>)
      const page = await service.listSellerProducts(req.user!.id, { cursor, limit })
      res.json(page)
    } catch (err) {
      next(err)
    }
  },
)

// ---------------------------------------------------------------------------
// GET /admin/products — admin only
// ---------------------------------------------------------------------------

router.get(
  '/admin/products',
  requireAuth('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePageParams(req.query as Record<string, unknown>)
      const q = typeof req.query.q === 'string' ? req.query.q.trim() || undefined : undefined
      const statusRaw = req.query.status as string | undefined
      const status =
        statusRaw === 'published' || statusRaw === 'unpublished' ? statusRaw : 'all'
      const page = await service.listAdminProducts({ q, status, cursor, limit })
      res.json(page)
    } catch (err) {
      next(err)
    }
  },
)

export { router as catalogRouter }
