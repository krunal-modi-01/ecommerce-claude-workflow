import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors'

// ---------------------------------------------------------------------------
// Mock the repository and identity module before importing service
// ---------------------------------------------------------------------------
vi.mock('./repository', () => ({
  findAllCategories: vi.fn(),
  browseProducts: vi.fn(),
  findProductById: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  setProductPublished: vi.fn(),
  deleteProduct: vi.fn(),
  listProductsBySeller: vi.fn(),
  listProductsAdmin: vi.fn(),
}))

vi.mock('../identity', () => ({
  getSellerConnectStatus: vi.fn(),
}))

import * as repo from './repository'
import * as identity from '../identity'
import {
  getProduct,
  createProduct,
  updateProduct,
  setPublished,
  deleteProduct,
  checkStock,
} from './service'

const mockFindById = vi.mocked(repo.findProductById)
const mockCreate = vi.mocked(repo.createProduct)
const mockUpdate = vi.mocked(repo.updateProduct)
const mockSetPublished = vi.mocked(repo.setProductPublished)
const mockDelete = vi.mocked(repo.deleteProduct)
const mockConnectStatus = vi.mocked(identity.getSellerConnectStatus)

const SELLER_ID = 'seller-uuid-1'
const OTHER_SELLER_ID = 'seller-uuid-2'
const ADMIN_ID = 'admin-uuid-1'
const PRODUCT_ID = 'product-uuid-1'

function makeProduct(overrides: Partial<{
  id: string
  sellerId: string
  published: boolean
  priceCents: number
  imageUrl: string
  stockQuantity: number
}> = {}) {
  return {
    id: PRODUCT_ID,
    sellerId: SELLER_ID,
    categoryId: 'electronics',
    title: 'Test Product',
    description: 'A test product',
    priceCents: 999,
    shippingCents: 0,
    stockQuantity: 10,
    imageUrl: 'https://example.com/img.jpg',
    published: false,
    searchVector: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getProduct
// ---------------------------------------------------------------------------
describe('getProduct', () => {
  it('returns a published product to anonymous callers', async () => {
    const p = makeProduct({ published: true })
    mockFindById.mockResolvedValue(p)
    await expect(getProduct(PRODUCT_ID)).resolves.toEqual(p)
  })

  it('throws NotFoundError for unpublished product accessed by anonymous', async () => {
    mockFindById.mockResolvedValue(makeProduct({ published: false }))
    await expect(getProduct(PRODUCT_ID)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws NotFoundError for unpublished product accessed by a different seller', async () => {
    mockFindById.mockResolvedValue(makeProduct({ published: false }))
    await expect(
      getProduct(PRODUCT_ID, { id: OTHER_SELLER_ID, role: 'seller' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('returns unpublished product to its owning seller', async () => {
    const p = makeProduct({ published: false })
    mockFindById.mockResolvedValue(p)
    await expect(
      getProduct(PRODUCT_ID, { id: SELLER_ID, role: 'seller' }),
    ).resolves.toEqual(p)
  })

  it('returns unpublished product to admin', async () => {
    const p = makeProduct({ published: false })
    mockFindById.mockResolvedValue(p)
    await expect(
      getProduct(PRODUCT_ID, { id: ADMIN_ID, role: 'admin' }),
    ).resolves.toEqual(p)
  })

  it('throws NotFoundError when product does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    await expect(getProduct('non-existent')).rejects.toBeInstanceOf(NotFoundError)
  })
})

// ---------------------------------------------------------------------------
// createProduct
// ---------------------------------------------------------------------------
describe('createProduct', () => {
  it('always creates the product in unpublished state', async () => {
    const p = makeProduct({ published: false })
    mockCreate.mockResolvedValue(p)
    await createProduct(SELLER_ID, {
      categoryId: 'electronics',
      title: 'Test',
      description: 'Desc',
      priceCents: 999,
      shippingCents: 0,
      stockQuantity: 5,
      imageUrl: '',
    })
    const callArg = mockCreate.mock.calls[0]![0]
    expect(callArg).not.toHaveProperty('published', true)
  })
})

// ---------------------------------------------------------------------------
// updateProduct
// ---------------------------------------------------------------------------
describe('updateProduct', () => {
  it('throws ForbiddenError when a seller tries to update another seller\'s product', async () => {
    mockFindById.mockResolvedValue(makeProduct({ sellerId: SELLER_ID }))
    await expect(
      updateProduct(PRODUCT_ID, OTHER_SELLER_ID, { title: 'Hack' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('allows the owning seller to update their product', async () => {
    const p = makeProduct()
    const updated = { ...p, title: 'New Title' }
    mockFindById.mockResolvedValue(p)
    mockUpdate.mockResolvedValue(updated)
    const result = await updateProduct(PRODUCT_ID, SELLER_ID, { title: 'New Title' })
    expect(result.title).toBe('New Title')
  })

  it('throws NotFoundError when the product does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    await expect(
      updateProduct(PRODUCT_ID, SELLER_ID, { title: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

// ---------------------------------------------------------------------------
// setPublished
// ---------------------------------------------------------------------------
describe('setPublished', () => {
  it('throws ForbiddenError when a seller tries to publish another seller\'s product', async () => {
    mockFindById.mockResolvedValue(makeProduct({ sellerId: SELLER_ID }))
    await expect(
      setPublished(PRODUCT_ID, { id: OTHER_SELLER_ID, role: 'seller' }, true),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws ValidationError when imageUrl is empty on publish', async () => {
    mockFindById.mockResolvedValue(makeProduct({ imageUrl: '' }))
    mockConnectStatus.mockResolvedValue({ onboardingComplete: true })
    await expect(
      setPublished(PRODUCT_ID, { id: SELLER_ID, role: 'seller' }, true),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError when priceCents is 0 on publish', async () => {
    mockFindById.mockResolvedValue(makeProduct({ priceCents: 0, imageUrl: 'https://img.jpg' }))
    mockConnectStatus.mockResolvedValue({ onboardingComplete: true })
    await expect(
      setPublished(PRODUCT_ID, { id: SELLER_ID, role: 'seller' }, true),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError when Stripe onboarding is incomplete', async () => {
    mockFindById.mockResolvedValue(makeProduct())
    mockConnectStatus.mockResolvedValue({ onboardingComplete: false })
    await expect(
      setPublished(PRODUCT_ID, { id: SELLER_ID, role: 'seller' }, true),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('publishes successfully when all preconditions are met', async () => {
    const p = makeProduct()
    const published = { ...p, published: true }
    mockFindById.mockResolvedValue(p)
    mockConnectStatus.mockResolvedValue({ onboardingComplete: true })
    mockSetPublished.mockResolvedValue(published)
    await expect(
      setPublished(PRODUCT_ID, { id: SELLER_ID, role: 'seller' }, true),
    ).resolves.toHaveProperty('published', true)
  })

  it('allows admin to publish without Stripe check', async () => {
    const p = makeProduct()
    const published = { ...p, published: true }
    mockFindById.mockResolvedValue(p)
    mockSetPublished.mockResolvedValue(published)
    await setPublished(PRODUCT_ID, { id: ADMIN_ID, role: 'admin' }, true)
    expect(mockConnectStatus).not.toHaveBeenCalled()
  })

  it('allows a seller to unpublish without precondition checks', async () => {
    const p = makeProduct({ published: true })
    const unpublished = { ...p, published: false }
    mockFindById.mockResolvedValue(p)
    mockSetPublished.mockResolvedValue(unpublished)
    await setPublished(PRODUCT_ID, { id: SELLER_ID, role: 'seller' }, false)
    expect(mockConnectStatus).not.toHaveBeenCalled()
    expect(mockSetPublished).toHaveBeenCalledWith(PRODUCT_ID, false)
  })

  it('throws ForbiddenError for a buyer role', async () => {
    mockFindById.mockResolvedValue(makeProduct())
    await expect(
      setPublished(PRODUCT_ID, { id: 'buyer-id', role: 'buyer' }, true),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// deleteProduct
// ---------------------------------------------------------------------------
describe('deleteProduct', () => {
  it('throws NotFoundError when product does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    await expect(deleteProduct(PRODUCT_ID)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deletes the product when it exists', async () => {
    mockFindById.mockResolvedValue(makeProduct())
    mockDelete.mockResolvedValue(undefined)
    await expect(deleteProduct(PRODUCT_ID)).resolves.toBeUndefined()
    expect(mockDelete).toHaveBeenCalledWith(PRODUCT_ID)
  })
})

// ---------------------------------------------------------------------------
// checkStock
// ---------------------------------------------------------------------------
describe('checkStock', () => {
  it('returns inStock true when stockQuantity > 0', async () => {
    mockFindById.mockResolvedValue(makeProduct({ stockQuantity: 5 }))
    await expect(checkStock(PRODUCT_ID)).resolves.toEqual({ inStock: true, stockQuantity: 5 })
  })

  it('returns inStock false when stockQuantity is 0', async () => {
    mockFindById.mockResolvedValue(makeProduct({ stockQuantity: 0 }))
    await expect(checkStock(PRODUCT_ID)).resolves.toEqual({ inStock: false, stockQuantity: 0 })
  })

  it('throws NotFoundError for unknown product', async () => {
    mockFindById.mockResolvedValue(null)
    await expect(checkStock('missing')).rejects.toBeInstanceOf(NotFoundError)
  })
})
