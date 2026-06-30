import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { components } from '@api-types'
import { Alert, Button, Card, Input } from '../components/ui'
import { ApiError, post } from '../lib/api'

type SellerRegistrationResponse = {
  user: components['schemas']['User']
  connectOnboardingUrl: string
}

export default function RegisterSellerPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await post<SellerRegistrationResponse>('/auth/register/seller', {
        displayName,
        email,
        password,
      })
      window.location.href = result.connectOnboardingUrl
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">Create a seller account</h1>
          <p className="mb-6 text-sm text-neutral-600">
            After registration you&apos;ll be redirected to Stripe to complete onboarding before
            you can publish products.
          </p>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              id="displayName"
              label="Display name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Creating account…' : 'Create seller account'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-neutral-600">
            Buying instead?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
              Create a buyer account
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-neutral-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
