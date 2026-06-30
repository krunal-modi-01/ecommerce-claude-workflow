import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, Select, SkeletonCard } from '../components/ui'
import { ApiError, get } from '../lib/api'
import type { components } from '@api-types'

type Product = components['schemas']['Product']
type Category = components['schemas']['Category']

type ProductPage = { items: Product[]; nextCursor?: string }
type CategoryList = Category[]

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.id}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xl">
      <Card className="flex flex-col gap-0 p-0 overflow-hidden h-full transition-shadow group-hover:shadow-md">
        <div className="h-48 bg-neutral-100 overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-neutral-400 text-sm">
              No image
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{product.title}</p>
          <p className="text-xs text-neutral-500">{product.categoryId}</p>
          <p className="text-base font-bold text-primary-700">{formatPrice(product.priceCents)}</p>
          {product.shippingCents === 0 ? (
            <Badge label="Free shipping" variant="success" />
          ) : (
            <p className="text-xs text-neutral-500">+ {formatPrice(product.shippingCents)} shipping</p>
          )}
        </div>
      </Card>
    </Link>
  )
}

const SKELETON_COUNT = 8

export default function ProductsPage() {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<CategoryList>([])
  const [products, setProducts] = useState<Product[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProducts = useCallback(
    async (q: string, catId: string, cursor?: string, append = false) => {
      if (!append) setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (catId) params.set('categoryId', catId)
        if (cursor) params.set('cursor', cursor)
        params.set('limit', '20')
        const page = await get<ProductPage>(`/products?${params.toString()}`)
        setProducts((prev) => (append ? [...prev, ...page.items] : page.items))
        setNextCursor(page.nextCursor)
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load products.')
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  // Load categories once on mount
  useEffect(() => {
    get<CategoryList>('/categories')
      .then(setCategories)
      .catch(() => {})
  }, [])

  // Fetch products when query or category changes (debounced for query)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setProducts([])
      setNextCursor(undefined)
      void fetchProducts(query, categoryId)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, categoryId, fetchProducts])

  async function handleLoadMore() {
    if (!nextCursor) return
    setIsFetchingMore(true)
    await fetchProducts(query, categoryId, nextCursor, true)
    setIsFetchingMore(false)
  }

  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <h1 className="mb-6 text-3xl font-bold text-neutral-900">Browse Products</h1>

        {/* Filters */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-neutral-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="search"
              placeholder="Search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          {categories.length > 0 && (
            <div className="sm:w-56">
              <Select
                id="category"
                label="Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categoryOptions}
              />
            </div>
          )}
        </div>

        {/* States */}
        {error && (
          <Alert variant="error" className="mb-6">
            {error}{' '}
            <button
              onClick={() => fetchProducts(query, categoryId)}
              className="underline font-medium"
            >
              Retry
            </button>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Alert variant="info">No products match your search. Try a different term or category.</Alert>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {nextCursor && (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="secondary"
                  loading={isFetchingMore}
                  onClick={() => void handleLoadMore()}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
