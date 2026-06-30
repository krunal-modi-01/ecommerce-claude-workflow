import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Input } from '../components/ui'
import { ApiError, post } from '../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setNetworkError(null)
    setLoading(true)
    try {
      await post('/auth/password-reset/request', { email })
      // Always show success on any API response — mirrors the no-enumeration guarantee
      setSubmitted(true)
    } catch (err) {
      // Only surface genuine network/server failures, not 4xx (API always returns 204)
      const message =
        err instanceof ApiError && err.status >= 500
          ? 'Something went wrong on our end. Please try again.'
          : err instanceof ApiError
            ? err.detail
            : 'Unable to reach the server. Check your connection and try again.'
      setNetworkError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">Reset your password</h1>
          <p className="mb-6 text-sm text-neutral-600">
            Enter your email and we&apos;ll send a reset link if an account exists.
          </p>

          {submitted ? (
            <>
              <Alert variant="success">
                If that email address is registered, you&apos;ll receive a password reset link
                shortly.
              </Alert>
              <p className="mt-4 text-center text-sm text-neutral-600">
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              {networkError && (
                <Alert variant="error" className="mb-4">
                  {networkError}
                </Alert>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
                <Button type="submit" loading={loading} className="w-full">
                  Send reset link
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-neutral-600">
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
