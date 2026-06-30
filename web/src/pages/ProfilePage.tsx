import { useState, type FormEvent } from 'react'
import { Alert, Button, Card, Input, Spinner } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { ApiError, patch } from '../lib/api'
import type { components } from '@api-types'

type User = components['schemas']['User']

export default function ProfilePage() {
  const { user, refresh, isLoading } = useAuth()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="md" className="text-primary-600" />
      </div>
    )
  }

  if (!user) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const changes: { displayName?: string; email?: string } = {}
      if (displayName !== user!.displayName) changes.displayName = displayName
      if (email !== user!.email) changes.email = email
      await patch<User>('/me', { ...changes, currentPassword })
      await refresh()
      setSuccess(true)
      setCurrentPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-6 text-2xl font-bold text-neutral-900">Your profile</h1>

          <div className="mb-6 rounded-md bg-neutral-50 px-4 py-3 text-sm">
            <p className="text-neutral-500">Role</p>
            <p className="font-medium capitalize text-neutral-800">{user.role}</p>
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}
          {success && (
            <Alert variant="success" className="mb-4">
              Profile updated successfully.
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
              disabled={saving}
            />
            <Input
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={saving}
            />
            <Input
              id="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={saving}
            />

            <Button type="submit" loading={saving} className="w-full">
              Save changes
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
