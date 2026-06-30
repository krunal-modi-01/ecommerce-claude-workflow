import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Input } from '../components/ui'
import { ApiError, post } from '../lib/api'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md">
          <Card>
            <Alert variant="error">
              This reset link is missing a token. Please request a new password reset.
            </Alert>
            <p className="mt-4 text-center text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                Request a new link
              </Link>
            </p>
          </Card>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await post('/auth/password-reset/confirm', { token, newPassword })
      navigate('/login', { state: { passwordReset: true } })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : 'An unexpected error occurred. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-6 text-2xl font-bold text-neutral-900">Set a new password</h1>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              id="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              id="confirmPassword"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              error={
                confirmPassword && confirmPassword !== newPassword
                  ? 'Passwords do not match.'
                  : undefined
              }
            />

            <Button type="submit" loading={loading} className="w-full">
              Reset password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
