import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Spinner } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { ApiError, get } from '../lib/api'
import type { components } from '@api-types'

type Product = components['schemas']['Product']

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    get<Product>(`/products/${id}`)
      .then(setProduct)
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : 'Failed to load product.')
      })
      .finally(() => setIsLoading(false))
  }, [id])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="md" className="text-primary-600" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md text-center">
          <Alert variant="error" className="mb-4">
            {error ?? 'Product not found.'}
          </Alert>
          <Link to="/" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            ← Back to products
          </Link>
        </div>
      </div>
    )
  }

  const isOwner = user?.role === 'seller' && user.id === product.sellerId
  const isAdmin = user?.role === 'admin'
  const showPublishedBadge = isOwner || isAdmin

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex text-sm font-medium text-primary-600 hover:text-primary-700">
          ← Back to products
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Image */}
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-80 items-center justify-center text-neutral-400">
                No image available
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <h1 className="flex-1 text-2xl font-bold text-neutral-900">{product.title}</h1>
              {showPublishedBadge && (
                <Badge
                  label={product.published ? 'Published' : 'Unpublished'}
                  variant={product.published ? 'success' : 'neutral'}
                />
              )}
            </div>

            <div>
              <p className="text-3xl font-bold text-primary-700">{formatPrice(product.priceCents)}</p>
              {product.shippingCents === 0 ? (
                <Badge label="Free shipping" variant="success" className="mt-1" />
              ) : (
                <p className="mt-1 text-sm text-neutral-500">+ {formatPrice(product.shippingCents)} shipping</p>
              )}
            </div>

            <p className="text-sm text-neutral-700 leading-relaxed">{product.description}</p>

            {product.stockQuantity > 0 ? (
              <p className="text-sm text-success-700 font-medium">
                {product.stockQuantity} in stock
              </p>
            ) : (
              <p className="text-sm text-error-600 font-medium">Out of stock</p>
            )}

            <Button
              className="w-full mt-2"
              disabled={product.stockQuantity === 0}
              title="Cart functionality coming soon"
            >
              {product.stockQuantity === 0 ? 'Out of stock' : 'Add to cart'}
            </Button>

            {(isOwner || isAdmin) && (
              <Link
                to={`/seller/products/${product.id}/edit`}
                className="text-center text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Edit listing
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
