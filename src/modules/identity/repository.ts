import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '../../lib/db'
import { passwordResetTokens, users } from '../../db/schema'
import type { UserRow } from './types'

type NewUserRow = typeof users.$inferInsert
type TokenRow = typeof passwordResetTokens.$inferSelect

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return rows[0] ?? null
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createUser(data: NewUserRow): Promise<UserRow> {
  const rows = await db.insert(users).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('createUser: insert returned no rows')
  return row
}

export async function updateUser(
  id: string,
  changes: Partial<Pick<UserRow, 'email' | 'passwordHash' | 'displayName' | 'stripeAccountId'>>,
): Promise<UserRow> {
  const rows = await db.update(users).set(changes).where(eq(users.id, id)).returning()
  const row = rows[0]
  if (!row) throw new Error(`updateUser: no row returned for id ${id}`)
  return row
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt })
}

export async function findActiveResetToken(tokenHash: string): Promise<TokenRow | null> {
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

// Atomically updates the user's password and invalidates ALL of their outstanding
// reset tokens in a single transaction, preventing replay of other active tokens.
export async function resetPasswordAtomically(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId))
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)))
  })
}
