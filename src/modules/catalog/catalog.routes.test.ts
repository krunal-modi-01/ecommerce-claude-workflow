/**
 * Route-layer auth/role enforcement tests.
 *
 * These test the Express middleware chain (requireAuth + role checks) rather
 * than business logic (covered by catalog.service.test.ts). They verify that
 * the right HTTP status codes are returned for auth/role violations.
 *
 * Note: full HTTP integration tests (using supertest) are intentionally out of
 * scope here because supertest is not installed. The service tests cover all
 * logic paths; these tests verify the middleware wiring.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

// ---------------------------------------------------------------------------
// Mock env before anything imports it (avoids requiring DATABASE_URL at test time)
// ---------------------------------------------------------------------------
vi.mock('../../lib/env', () => ({
  env: {
    jwtSecret: 'test-secret-key-for-vitest',
    databaseUrl: 'postgres://test',
    baseUrl: 'http://localhost:3000',
    port: 3000,
    nodeEnv: 'test',
  },
}))

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}))

import { requireAuth } from '../identity/middleware'
import { jwtVerify } from 'jose'

const mockJwtVerify = vi.mocked(jwtVerify)

function makeReq(cookie?: string): Partial<Request> {
  return {
    cookies: cookie ? { auth_token: cookie } : {},
    user: undefined,
  }
}

function makeRes(): Partial<Response> {
  return {}
}

// Use a plain vi.fn() cast — we only care about call tracking, not the full NextFunction interface
function makeNext(): Mock {
  return vi.fn()
}

// Minimal jwtVerify mock return value accepted at runtime (TS cast via unknown)
function mockJwt(sub: string, role: string) {
  mockJwtVerify.mockResolvedValue({
    payload: { sub, role },
    protectedHeader: { alg: 'HS256' },
  } as unknown as Awaited<ReturnType<typeof jwtVerify>>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAuth middleware', () => {
  it('calls next(UnauthorizedError) when no cookie is present', async () => {
    const middleware = requireAuth()
    const req = makeReq(undefined) as Request
    const res = makeRes() as Response
    const next = makeNext()

    await middleware(req, res, next as unknown as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0]![0]
    expect((err as { status: number }).status).toBe(401)
  })

  it('calls next(UnauthorizedError) when JWT is invalid', async () => {
    mockJwtVerify.mockRejectedValue(new Error('invalid jwt'))
    const middleware = requireAuth()
    const req = makeReq('bad.token.value') as Request
    const res = makeRes() as Response
    const next = makeNext()

    await middleware(req, res, next as unknown as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0]![0]
    expect((err as { status: number }).status).toBe(401)
  })

  it('calls next(ForbiddenError) when role does not match', async () => {
    mockJwt('user-1', 'buyer')

    const middleware = requireAuth('seller') // requires seller, token has buyer
    const req = makeReq('valid.buyer.token') as Request
    const res = makeRes() as Response
    const next = makeNext()

    await middleware(req, res, next as unknown as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0]![0]
    expect((err as { status: number }).status).toBe(403)
  })

  it('sets req.user and calls next() for a valid token with matching role', async () => {
    mockJwt('seller-1', 'seller')

    const middleware = requireAuth('seller')
    const req = makeReq('valid.seller.token') as Request
    const res = makeRes() as Response
    const next = makeNext()

    await middleware(req, res, next as unknown as NextFunction)

    expect(req.user).toEqual({ id: 'seller-1', role: 'seller' })
    expect(next).toHaveBeenCalledWith() // called with no args = success
  })

  it('accepts any valid role when no role restriction is given', async () => {
    mockJwt('buyer-1', 'buyer')

    const middleware = requireAuth() // no role restriction
    const req = makeReq('valid.buyer.token') as Request
    const res = makeRes() as Response
    const next = makeNext()

    await middleware(req, res, next as unknown as NextFunction)

    expect(req.user).toEqual({ id: 'buyer-1', role: 'buyer' })
    expect(next).toHaveBeenCalledWith()
  })

  it('returns 403 for admin-only endpoint accessed by seller', async () => {
    mockJwt('seller-1', 'seller')

    const middleware = requireAuth('admin') // DELETE /products requires admin
    const req = makeReq('valid.seller.token') as Request
    const res = makeRes() as Response
    const next = makeNext()

    await middleware(req, res, next as unknown as NextFunction)

    const err = next.mock.calls[0]![0]
    expect((err as { status: number }).status).toBe(403)
  })
})
