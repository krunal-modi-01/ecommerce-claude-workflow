import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Input, Select, Spinner, Textarea } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { ApiError, del, get, patch } from '../../lib/api'
import type { components } from '@api-types'

type Product = components['schemas']['Product']
type Category = components['schemas']['Category']

export default function SellerEditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priceDisplay, setPriceDisplay] = useState('')
  const [shippingDisplay, setShippingDisplay] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockQuantity, setStockQuantity] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      get<Product>(`/products/${id}`),
      get<Category[]>('/categories'),
    ])
      .then(([p, cats]) => {
        setProduct(p)
        setCategories(cats)
        setTitle(p.title)
        setDescription(p.description)
        setPriceDisplay((p.priceCents / 100).toFixed(2))
        setShippingDisplay((p.shippingCents / 100).toFixed(2))
        setCategoryId(p.categoryId)
        setStockQuantity(String(p.stockQuantity))
        setImageUrl(p.imageUrl ?? '')
      })
      .catch((err) => {
        setPageError(err instanceof ApiError ? err.detail : 'Failed to load product.')
      })
      .finally(() => setPageLoading(false))
  }, [id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)

    const priceCents = Math.round(parseFloat(priceDisplay) * 100)
    const shippingCents = Math.round(parseFloat(shippingDisplay || '0') * 100)
    const qty = parseInt(stockQuantity, 10)

    if (isNaN(priceCents) || priceCents <= 0) {
      setSaveError('Price must be a positive number.')
      return
    }
    if (isNaN(shippingCents) || shippingCents < 0) {
      setSaveError('Shipping cost must be zero or a positive number.')
      return
    }
    if (isNaN(qty) || qty < 0) {
      setSaveError('Stock quantity must be zero or more.')
      return
    }

    setSaving(true)
    try {
      await patch<Product>(`/products/${id}`, {
        title,
        description,
        priceCents,
        shippingCents,
        categoryId,
        stockQuantity: qty,
        imageUrl,
      })
      navigate('/seller/products')
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await del(`/products/${id}`)
      navigate('/seller/products')
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : 'Failed to delete product.')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="md" className="text-primary-600" />
      </div>
    )
  }

  if (pageError || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md">
          <Alert variant="error" className="mb-4">
            {pageError ?? 'Product not found.'}
          </Alert>
          <Link to="/seller/products" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            ← Back to listings
          </Link>
        </div>
      </div>
    )
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))
  const isAdmin = user?.role === 'admin'

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/seller/products" className="mb-6 inline-flex text-sm font-medium text-primary-600 hover:text-primary-700">
          ← Back to listings
        </Link>

        <Card className="mt-4">
          <h1 className="mb-6 text-2xl font-bold text-neutral-900">Edit listing</h1>

          {saveError && (
            <Alert variant="error" className="mb-4">
              {saveError}
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
              disabled={saving}
            />

            <Textarea
              id="description"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={saving}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="price"
                label="Price ($)"
                type="number"
                min="0.01"
                step="0.01"
                value={priceDisplay}
                onChange={(e) => setPriceDisplay(e.target.value)}
                required
                disabled={saving}
              />
              <Input
                id="shipping"
                label="Shipping cost ($)"
                type="number"
                min="0"
                step="0.01"
                value={shippingDisplay}
                onChange={(e) => setShippingDisplay(e.target.value)}
                disabled={saving}
              />
            </div>

            <Select
              id="category"
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categoryOptions}
              required
              disabled={saving}
            />

            <Input
              id="stock"
              label="Stock quantity"
              type="number"
              min="0"
              step="1"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              required
              disabled={saving}
            />

            <Input
              id="imageUrl"
              label="Image URL"
              type="url"
              placeholder="https://…"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={saving}
            />

            <Button type="submit" loading={saving} className="w-full">
              Save changes
            </Button>
          </form>

          {isAdmin && (
            <div className="mt-6 border-t border-neutral-200 pt-6">
              <p className="mb-3 text-sm font-medium text-neutral-700">Danger zone</p>
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-error-700">Are you sure? This cannot be undone.</p>
                  <Button
                    variant="primary"
                    loading={deleting}
                    className="bg-error-600 hover:bg-error-700 border-error-600"
                    onClick={() => void handleDelete()}
                  >
                    Yes, delete
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="border-error-300 text-error-700 hover:bg-error-50"
                  onClick={() => void handleDelete()}
                >
                  Delete listing
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
