import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Input, Select, Spinner, Textarea } from '../../components/ui'
import { ApiError, get, post } from '../../lib/api'
import type { components } from '@api-types'

type Product = components['schemas']['Product']
type Category = components['schemas']['Category']

export default function SellerCreateProductPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priceDisplay, setPriceDisplay] = useState('')
  const [shippingDisplay, setShippingDisplay] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockQuantity, setStockQuantity] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    get<Category[]>('/categories')
      .then((cats) => {
        setCategories(cats)
        if (cats[0]) setCategoryId(cats[0].id)
      })
      .catch(() => {})
      .finally(() => setCategoriesLoading(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const priceCents = Math.round(parseFloat(priceDisplay) * 100)
    const shippingCents = Math.round(parseFloat(shippingDisplay || '0') * 100)
    const qty = parseInt(stockQuantity, 10)

    if (isNaN(priceCents) || priceCents <= 0) {
      setError('Price must be a positive number.')
      return
    }
    if (isNaN(shippingCents) || shippingCents < 0) {
      setError('Shipping cost must be zero or a positive number.')
      return
    }
    if (isNaN(qty) || qty < 0) {
      setError('Stock quantity must be zero or more.')
      return
    }

    setLoading(true)
    try {
      await post<Product>('/products', {
        title,
        description,
        priceCents,
        shippingCents,
        categoryId,
        stockQuantity: qty,
        imageUrl,
      })
      navigate('/seller/products', { state: { created: true } })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (categoriesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="md" className="text-primary-600" />
      </div>
    )
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/seller/products" className="mb-6 inline-flex text-sm font-medium text-primary-600 hover:text-primary-700">
          ← Back to listings
        </Link>

        <Card className="mt-4">
          <h1 className="mb-6 text-2xl font-bold text-neutral-900">New listing</h1>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
            <Input
              id="title"
              label="Title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
            />

            <Textarea
              id="description"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={loading}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="price"
                label="Price ($)"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={priceDisplay}
                onChange={(e) => setPriceDisplay(e.target.value)}
                required
                disabled={loading}
              />
              <Input
                id="shipping"
                label="Shipping cost ($)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={shippingDisplay}
                onChange={(e) => setShippingDisplay(e.target.value)}
                disabled={loading}
              />
            </div>

            <Select
              id="category"
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categoryOptions}
              required
              disabled={loading}
            />

            <Input
              id="stock"
              label="Stock quantity"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              required
              disabled={loading}
            />

            <Input
              id="imageUrl"
              label="Image URL"
              type="url"
              placeholder="https://…"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={loading}
            />

            <p className="text-xs text-neutral-500">
              New listings start as drafts. You can publish them from your listings page once you&apos;ve completed Stripe onboarding.
            </p>

            <Button type="submit" loading={loading} className="w-full">
              Create listing
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
