import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors'
import { getSellerConnectStatus } from '../identity'
import * as repo from './repository'
import type { AdminListParams, BrowseParams, ProductPage, ProductRow, SellerListParams } from './types'

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories() {
  return repo.findAllCategories()
}

// ---------------------------------------------------------------------------
// Products — public browse
// ---------------------------------------------------------------------------

export async function listProducts(params: BrowseParams): Promise<ProductPage> {
  return repo.browseProducts(params)
}

// ---------------------------------------------------------------------------
// Products — single lookup (visibility enforced here)
// ---------------------------------------------------------------------------

export async function getProduct(
  id: string,
  requestingUser?: { id: string; role: string },
): Promise<ProductRow> {
  const product = await repo.findProductById(id)
  if (!product) throw new NotFoundError()

  if (!product.published) {
    const isSeller = requestingUser?.role === 'seller' && requestingUser.id === product.sellerId
    const isAdmin = requestingUser?.role === 'admin'
    if (!isSeller && !isAdmin) throw new NotFoundError()
  }

  return product
}

// ---------------------------------------------------------------------------
// Products — seller create / update / publish
// ---------------------------------------------------------------------------

export async function createProduct(
  sellerId: string,
  input: {
    categoryId: string
    title: string
    description: string
    priceCents: number
    shippingCents: number
    stockQuantity: number
    imageUrl: string
  },
): Promise<ProductRow> {
  return repo.createProduct({ sellerId, ...input })
}

export async function updateProduct(
  productId: string,
  requestingSellerId: string,
  changes: Partial<
    Pick<ProductRow, 'title' | 'description' | 'priceCents' | 'shippingCents' | 'categoryId' | 'stockQuantity' | 'imageUrl'>
  >,
): Promise<ProductRow> {
  const product = await repo.findProductById(productId)
  if (!product) throw new NotFoundError()
  if (product.sellerId !== requestingSellerId) throw new ForbiddenError()
  return repo.updateProduct(productId, changes)
}

export async function setPublished(
  productId: string,
  requestingUser: { id: string; role: string },
  published: boolean,
): Promise<ProductRow> {
  const product = await repo.findProductById(productId)
  if (!product) throw new NotFoundError()

  const isAdmin = requestingUser.role === 'admin'
  const isSeller = requestingUser.role === 'seller'

  if (isSeller) {
    if (product.sellerId !== requestingUser.id) throw new ForbiddenError()

    if (published) {
      if (!product.imageUrl) {
        throw new ValidationError('Cannot publish: image URL is required.')
      }
      if (product.priceCents <= 0) {
        throw new ValidationError('Cannot publish: price must be greater than zero.')
      }
      const { onboardingComplete } = await getSellerConnectStatus(requestingUser.id)
      if (!onboardingComplete) {
        throw new ValidationError('Cannot publish: Stripe onboarding is not complete.')
      }
    }
  } else if (!isAdmin) {
    throw new ForbiddenError()
  }

  return repo.setProductPublished(productId, published)
}

// ---------------------------------------------------------------------------
// Products — admin delete
// ---------------------------------------------------------------------------

export async function deleteProduct(productId: string): Promise<void> {
  const product = await repo.findProductById(productId)
  if (!product) throw new NotFoundError()
  await repo.deleteProduct(productId)
}

// ---------------------------------------------------------------------------
// Products — seller list
// ---------------------------------------------------------------------------

export async function listSellerProducts(
  sellerId: string,
  params: SellerListParams,
): Promise<ProductPage> {
  return repo.listProductsBySeller(sellerId, params)
}

// ---------------------------------------------------------------------------
// Products — admin list
// ---------------------------------------------------------------------------

export async function listAdminProducts(params: AdminListParams): Promise<ProductPage> {
  return repo.listProductsAdmin(params)
}

// ---------------------------------------------------------------------------
// checkStock — consumed by the cart module
// ---------------------------------------------------------------------------

export async function checkStock(productId: string): Promise<{ inStock: boolean; stockQuantity: number }> {
  const product = await repo.findProductById(productId)
  if (!product) throw new NotFoundError()
  return { inStock: product.stockQuantity > 0, stockQuantity: product.stockQuantity }
}
