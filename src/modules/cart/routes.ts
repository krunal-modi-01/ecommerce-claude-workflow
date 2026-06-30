import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { ValidationError } from '../../lib/errors'
import { requireAuth } from '../identity'
import * as service from './service'

const router = Router()

function validate<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const detail = result.error.errors.map((e) => e.message).join('; ')
    throw new ValidationError(detail)
  }
  return result.data
}

const addItemSchema = z.object({
  productId: z.string().uuid('productId must be a valid UUID.'),
  quantity: z.number().int().min(1, 'quantity must be at least 1.'),
})

const updateItemSchema = z.object({
  quantity: z.number().int().min(1, 'quantity must be at least 1.'),
})

router.get('/cart', requireAuth('buyer'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = await service.getCart(req.user!.id)
    res.json(cart)
  } catch (err) {
    next(err)
  }
})

router.post(
  '/cart/items',
  requireAuth('buyer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, quantity } = validate(addItemSchema, req.body)
      console.log('Adding item to cart:', { userId: req.user!.id, productId, quantity })
      const cart = await service.addItem(req.user!.id, productId, quantity)
      res.json(cart)
    } catch (err) {
      console.log(err)
      next(err)
    }
  },
)

router.patch(
  '/cart/items/:productId',
  requireAuth('buyer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { quantity } = validate(updateItemSchema, req.body)
      const cart = await service.updateItem(req.user!.id, req.params['productId'] as string, quantity)
      res.json(cart)
    } catch (err) {
      next(err)
    }
  },
)

router.delete(
  '/cart/items/:productId',
  requireAuth('buyer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cart = await service.removeItem(req.user!.id, req.params['productId'] as string)
      res.json(cart)
    } catch (err) {
      next(err)
    }
  },
)

export { router as cartRouter }
