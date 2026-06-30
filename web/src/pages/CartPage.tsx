import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Badge, Button, Card, LinkButton, Spinner } from '../components/ui'
import { ApiError, del, get, patch } from '../lib/api'
import type { components } from '@api-types'

type Cart = components['schemas']['Cart']
type CartLineItem = components['schemas']['CartLineItem']

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function CartPage() {
  const navigate = useNavigate()
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null)
  const [removingProductId, setRemovingProductId] = useState<string | null>(null)

  async function fetchCart() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await get<Cart>('/cart')
      setCart(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load your cart.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchCart()
  }, [])

  async function handleQuantityChange(productId: string, newQuantity: number) {
    if (newQuantity < 1) return
    setUpdatingProductId(productId)
    try {
      const updated = await patch<Cart>(`/cart/items/${productId}`, { quantity: newQuantity })
      setCart(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to update quantity.')
    } finally {
      setUpdatingProductId(null)
    }
  }

  async function handleRemove(productId: string) {
    setRemovingProductId(productId)
    try {
      const updated = await del<Cart>(`/cart/items/${productId}`)
      setCart(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to remove item.')
    } finally {
      setRemovingProductId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="md" className="text-primary-600" />
      </div>
    )
  }

  if (error && !cart) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert variant="error" className="mb-4">{error}</Alert>
        <Button variant="secondary" onClick={() => void fetchCart()}>
          Retry
        </Button>
      </div>
    )
  }

  const isEmpty = !cart || cart.items.length === 0
  const itemCount = cart?.items.length ?? 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Your Cart</h1>

      {error && (
        <Alert variant="error" className="mb-4">{error}</Alert>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Alert variant="info">Your cart is empty.</Alert>
          <LinkButton to="/" variant="secondary">Browse products</LinkButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Line items */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {cart!.sellerId && (
              <div className="flex items-center gap-2">
                <Badge
                  label={`Sold by seller ${cart!.sellerId.slice(0, 8)}`}
                  variant="info"
                />
              </div>
            )}

            {cart!.items.map((item: CartLineItem) => {
              const isUpdating = updatingProductId === item.productId
              const isRemoving = removingProductId === item.productId

              return (
                <Card key={item.productId}>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-6">
                    {/* Product info */}
                    <div className="flex-1">
                      <p className="font-semibold text-neutral-900">{item.productTitle}</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {formatPrice(item.snapshotPriceCents)} each
                      </p>
                      <div className="mt-1">
                        {item.shippingCents === 0 ? (
                          <Badge label="Free shipping" variant="success" />
                        ) : (
                          <p className="text-sm text-neutral-500">
                            + {formatPrice(item.shippingCents)} shipping
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        disabled={item.quantity <= 1 || isUpdating || isRemoving}
                        onClick={() => void handleQuantityChange(item.productId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </Button>
                      <span className="w-8 text-center text-neutral-900">
                        {isUpdating ? (
                          <Spinner size="sm" className="mx-auto text-primary-600" />
                        ) : (
                          item.quantity
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        disabled={isUpdating || isRemoving}
                        onClick={() => void handleQuantityChange(item.productId, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </Button>
                    </div>

                    {/* Line total + remove */}
                    <div className="flex flex-col items-end gap-2">
                      <p className="font-bold text-neutral-900">
                        {formatPrice(item.lineTotalCents)}
                      </p>
                      <Button
                        variant="ghost"
                        loading={isRemoving}
                        disabled={isUpdating}
                        onClick={() => void handleRemove(item.productId)}
                        className="text-sm text-error-600 hover:text-error-700"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <Card>
              <div className="flex flex-col gap-4 p-4">
                <h2 className="font-semibold text-neutral-900">Order Summary</h2>
                <div className="flex justify-between text-sm text-neutral-700">
                  <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                  <span>{formatPrice(cart!.totalCents)}</span>
                </div>
                <div className="border-t border-neutral-200 pt-4">
                  <div className="mb-4 flex justify-between font-bold text-neutral-900">
                    <span>Total</span>
                    <span>{formatPrice(cart!.totalCents)}</span>
                  </div>
                  <Button
                    className="w-full"
                    disabled={isEmpty}
                    onClick={() => navigate('/checkout')}
                  >
                    Proceed to Checkout
                  </Button>
                </div>
                <LinkButton to="/" variant="ghost" className="text-center text-sm">
                  Continue shopping
                </LinkButton>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
