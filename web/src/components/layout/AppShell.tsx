import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Alert, Badge, Button, LinkButton, Skeleton } from '../ui'
import { useAuth } from '../../hooks/useAuth'

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  admin: 'Admin',
}

const navBase =
  'text-sm font-medium transition-colors rounded ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? `${navBase} text-primary-600 font-semibold`
    : `${navBase} text-neutral-600 hover:text-neutral-900`
}

function Brand() {
  return (
    <Link
      to="/"
      className="shrink-0 text-lg font-bold text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
    >
      Marketplace
    </Link>
  )
}

function PrimaryNav() {
  const { user, isLoading } = useAuth()
  const role = isLoading ? undefined : user?.role

  return (
    <nav
      className="hidden sm:flex items-center gap-6"
      aria-label="Primary navigation"
    >
      <NavLink to="/" end className={navClass}>
        Browse
      </NavLink>

      {role === 'buyer' && (
        <>
          <NavLink to="/cart" className={navClass}>
            Cart
          </NavLink>
          <NavLink to="/orders" className={navClass}>
            Orders
          </NavLink>
        </>
      )}

      {role === 'seller' && (
        <NavLink to="/seller/products" className={navClass}>
          My Listings
        </NavLink>
      )}

      {role === 'admin' && (
        <NavLink to="/admin/products" className={navClass}>
          Admin
        </NavLink>
      )}
    </nav>
  )
}

function AuthControls() {
  const { user, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    navigate('/login')
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 shrink-0" aria-hidden="true">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-3 shrink-0">
        <Badge label={ROLE_LABELS[user.role] ?? user.role} variant="neutral" />
        <Link
          to="/profile"
          className="max-w-[12rem] truncate text-sm font-medium text-neutral-700 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        >
          {user.displayName}
        </Link>
        <Button
          variant="ghost"
          loading={loggingOut}
          onClick={() => void handleLogout()}
        >
          Logout
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
      <LinkButton to="/login" variant="ghost">
        Sign in
      </LinkButton>
      <LinkButton to="/register" variant="secondary">
        Create account
      </LinkButton>
    </div>
  )
}

function HamburgerPlaceholder() {
  return (
    <button
      type="button"
      className="sm:hidden p-2 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-40"
      aria-label="Open navigation menu (coming soon)"
      disabled
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  )
}

export default function AppShell() {
  return (
    <>
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Brand />
          <div className="flex-1 flex items-center gap-6">
            <PrimaryNav />
          </div>
          <AuthControls />
          <HamburgerPlaceholder />
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  )
}
