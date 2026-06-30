import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Spinner } from './components/ui'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import RegisterBuyerPage from './pages/RegisterBuyerPage'
import RegisterSellerPage from './pages/RegisterSellerPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfilePage from './pages/ProfilePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import SellerProductsPage from './pages/seller/SellerProductsPage'
import SellerCreateProductPage from './pages/seller/SellerCreateProductPage'
import SellerEditProductPage from './pages/seller/SellerEditProductPage'
import CartPage from './pages/CartPage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="md" className="text-primary-600" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function SellerRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="md" className="text-primary-600" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'seller') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Auth pages — standalone centered-card layouts, no shell */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterBuyerPage />} />
      <Route path="/register/seller" element={<RegisterSellerPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* All other pages get the persistent header shell */}
      <Route element={<AppShell />}>
        <Route path="/" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <CartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seller/products"
          element={
            <SellerRoute>
              <SellerProductsPage />
            </SellerRoute>
          }
        />
        <Route
          path="/seller/products/new"
          element={
            <SellerRoute>
              <SellerCreateProductPage />
            </SellerRoute>
          }
        />
        <Route
          path="/seller/products/:id/edit"
          element={
            <SellerRoute>
              <SellerEditProductPage />
            </SellerRoute>
          }
        />
      </Route>
    </Routes>
  )
}
