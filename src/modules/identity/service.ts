import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { createHash, randomBytes } from 'crypto'
import type { Response } from 'express'
import { env } from '../../lib/env'
import { ConflictError, InvalidTokenError, NotFoundError, UnauthorizedError } from '../../lib/errors'
import * as repo from './repository'
import * as stripe from '../stripe-adapter'
import * as emailService from '../email-service'
import type { Role, User, UserRow } from './types'

const BCRYPT_ROUNDS = 12
const COOKIE_NAME = 'auth_token'

function jwtKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret)
}

function toUser(row: UserRow): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _ph, ...user } = row
  return user
}

async function signToken(userId: string, role: Role): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtKey())
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export async function registerBuyer(input: {
  email: string
  password: string
  displayName: string
}): Promise<User> {
  const existing = await repo.findUserByEmail(input.email)
  if (existing) throw new ConflictError('That email address is already registered.')
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  const row = await repo.createUser({
    email: input.email,
    passwordHash,
    displayName: input.displayName,
    role: 'buyer',
  })
  return toUser(row)
}

// Stripe calls are made before any DB write so that a Stripe failure leaves no
// orphaned user row. If createUser fails after Stripe succeeds, the Stripe
// account is orphaned but the email remains available for a clean retry.
export async function registerSeller(input: {
  email: string
  password: string
  displayName: string
}): Promise<{ user: User; connectOnboardingUrl: string }> {
  const existing = await repo.findUserByEmail(input.email)
  if (existing) throw new ConflictError('That email address is already registered.')

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)

  const { stripeAccountId } = await stripe.createConnectAccount()
  const connectOnboardingUrl = await stripe.createConnectOnboardingUrl(
    stripeAccountId,
    `${env.baseUrl}/seller/products`,
    `${env.baseUrl}/register/seller`,
  )

  const row = await repo.createUser({
    email: input.email,
    passwordHash,
    displayName: input.displayName,
    role: 'seller',
    stripeAccountId,
  })

  return { user: toUser(row), connectOnboardingUrl }
}

export async function login(
  input: { email: string; password: string },
  res: Response,
): Promise<User> {
  const row = await repo.findUserByEmail(input.email)
  if (!row) throw new UnauthorizedError('Invalid email or password.')
  const valid = await bcrypt.compare(input.password, row.passwordHash)
  if (!valid) throw new UnauthorizedError('Invalid email or password.')
  const token = await signToken(row.id, row.role)
  setAuthCookie(res, token)
  return toUser(row)
}

export function logout(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

export async function getProfile(userId: string): Promise<User> {
  const row = await repo.findUserById(userId)
  if (!row) throw new NotFoundError()
  return toUser(row)
}

export async function updateProfile(
  userId: string,
  changes: { displayName?: string; email?: string },
  currentPassword: string,
): Promise<User> {
  const row = await repo.findUserById(userId)
  if (!row) throw new NotFoundError()
  const valid = await bcrypt.compare(currentPassword, row.passwordHash)
  if (!valid) throw new UnauthorizedError('Current password is incorrect.')
  if (changes.email && changes.email !== row.email) {
    const existing = await repo.findUserByEmail(changes.email)
    if (existing) throw new ConflictError('That email address is already registered.')
  }
  const updated = await repo.updateUser(userId, changes)
  return toUser(updated)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const row = await repo.findUserByEmail(email)
  if (!row) return // no account enumeration
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await repo.createPasswordResetToken(row.id, tokenHash, expiresAt)
  await emailService.sendPasswordReset(email, rawToken, expiresAt)
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const tokenRow = await repo.findActiveResetToken(tokenHash)
  if (!tokenRow) throw new InvalidTokenError('This link has expired or has already been used.')
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  // Single transaction: update password + invalidate all outstanding tokens for this user
  await repo.resetPasswordAtomically(tokenRow.userId, passwordHash)
}

export async function getSellerConnectStatus(
  userId: string,
): Promise<{ onboardingComplete: boolean }> {
  const row = await repo.findUserById(userId)
  if (!row || row.role !== 'seller') throw new NotFoundError('User is not a seller.')
  if (!row.stripeAccountId) return { onboardingComplete: false }
  const { chargesEnabled } = await stripe.getConnectAccountStatus(row.stripeAccountId)
  return { onboardingComplete: chargesEnabled }
}
