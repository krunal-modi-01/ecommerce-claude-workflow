import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, Skeleton } from '../../components/ui'
import { ApiError, get, patch } from '../../lib/api'
import type { components } from '@api-types'

type Product = components['schemas']['Product']
type ProductPage = { items: Product[]; nextCursor?: string }

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function loadProducts(cursor?: string, append = false) {
    if (!append) setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const page = await get<ProductPage>(`/seller/products?${params.toString()}`)
      setProducts((prev) => (append ? [...prev, ...page.items] : page.items))
      setNextCursor(page.nextCursor)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load products.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  async function handleTogglePublished(product: Product) {
    setTogglingId(product.id)
    setToggleError(null)
    try {
      const updated = await patch<Product>(`/products/${product.id}/published`, {
        published: !product.published,
      })
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setToggleError(err instanceof ApiError ? err.detail : 'Failed to update product.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleLoadMore() {
    if (!nextCursor) return
    setIsFetchingMore(true)
    await loadProducts(nextCursor, true)
    setIsFetchingMore(false)
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900">Your Listings</h1>
          <Link to="/seller/products/new">
            <Button variant="primary">+ New listing</Button>
          </Link>
        </div>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {toggleError && (
          <Alert variant="error" className="mb-4">
            {toggleError}
          </Alert>
        )}

        {isLoading ? (
          <Card>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 flex-shrink-0" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </Card>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Alert variant="info">You haven&apos;t listed any products yet.</Alert>
            <Link to="/seller/products/new">
              <Button variant="primary">Create your first listing</Button>
            </Link>
          </div>
        ) : (
          <Card className="p-0 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-neutral-200 bg-neutral-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <span>Product</span>
              <span className="w-20 text-right">Price</span>
              <span className="w-16 text-right">Stock</span>
              <span className="w-24 text-center">Status</span>
              <span className="w-28 text-right">Actions</span>
            </div>

            <ul className="divide-y divide-neutral-100">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-6 py-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full" />
                      )}
                    </div>
                    <p className="truncate text-sm font-medium text-neutral-900">{product.title}</p>
                  </div>

                  <span className="w-20 text-right text-sm text-neutral-700">
                    {formatPrice(product.priceCents)}
                  </span>

                  <span className="w-16 text-right text-sm text-neutral-700">
                    {product.stockQuantity}
                  </span>

                  <div className="flex w-24 justify-center">
                    <Badge
                      label={product.published ? 'Published' : 'Draft'}
                      variant={product.published ? 'success' : 'neutral'}
                    />
                  </div>

                  <div className="flex w-28 items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      loading={togglingId === product.id}
                      onClick={() => void handleTogglePublished(product)}
                    >
                      {product.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Link
                      to={`/seller/products/${product.id}/edit`}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    >
                      Edit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {nextCursor && (
              <div className="flex justify-center border-t border-neutral-100 px-6 py-4">
                <Button variant="secondary" loading={isFetchingMore} onClick={() => void handleLoadMore()}>
                  Load more
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
