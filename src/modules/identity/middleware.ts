import { jwtVerify } from 'jose'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { env } from '../../lib/env'
import { ForbiddenError, UnauthorizedError } from '../../lib/errors'
import type { Role } from './types'

const KNOWN_ROLES: readonly Role[] = ['buyer', 'seller', 'admin']

function jwtKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret)
}

export function requireAuth(role?: Role): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = (req.cookies as Record<string, string | undefined>)['auth_token']
    if (!token) {
      next(new UnauthorizedError())
      return
    }
    try {
      const { payload } = await jwtVerify(token, jwtKey())
      const userId = payload.sub as string
      const userRole = payload['role'] as string
      if (!KNOWN_ROLES.includes(userRole as Role)) {
        next(new UnauthorizedError())
        return
      }
      if (role && userRole !== role) {
        next(new ForbiddenError())
        return
      }
      req.user = { id: userId, role: userRole as Role }
      next()
    } catch {
      next(new UnauthorizedError())
    }
  }
}
