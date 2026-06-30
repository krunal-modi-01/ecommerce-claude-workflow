import type { users } from '../../db/schema'

export type Role = 'buyer' | 'seller' | 'admin'

// Full DB row including passwordHash — internal to this module only
export type UserRow = typeof users.$inferSelect

// Public user shape — passwordHash is never returned to callers
export type User = Omit<UserRow, 'passwordHash'>

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role }
    }
  }
}
