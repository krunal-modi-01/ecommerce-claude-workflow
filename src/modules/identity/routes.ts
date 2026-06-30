import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { ValidationError } from '../../lib/errors'
import * as service from './service'
import { requireAuth } from './middleware'

const router = Router()

const registerSchema = z.object({
  email: z.string().email('Must be a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  displayName: z.string().min(1, 'Display name is required.'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
})

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
})

const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().min(1, 'Current password is required.'),
})

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const detail = result.error.errors.map((e) => e.message).join('; ')
    throw new ValidationError(detail)
  }
  return result.data
}

router.post(
  '/auth/register/buyer',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = validate(registerSchema, req.body)
      const user = await service.registerBuyer(input)
      res.status(201).json(user)
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/auth/register/seller',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = validate(registerSchema, req.body)
      const result = await service.registerSeller(input)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/auth/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = validate(loginSchema, req.body)
      const user = await service.login(input, res)
      res.json(user)
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/auth/logout',
  requireAuth(),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      service.logout(res)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/auth/password-reset/request',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = validate(passwordResetRequestSchema, req.body)
      await service.requestPasswordReset(email)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

router.post(
  '/auth/password-reset/confirm',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = validate(passwordResetConfirmSchema, req.body)
      await service.resetPassword(token, newPassword)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

router.get(
  '/me',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await service.getProfile(req.user!.id)
      res.json(user)
    } catch (err) {
      next(err)
    }
  },
)

router.patch(
  '/me',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = validate(updateProfileSchema, req.body)
      const { currentPassword, ...changes } = input
      const user = await service.updateProfile(req.user!.id, changes, currentPassword)
      res.json(user)
    } catch (err) {
      next(err)
    }
  },
)

export { router as identityRouter }
