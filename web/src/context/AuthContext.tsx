import { createContext, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { components } from '@api-types'
import { get, post } from '../lib/api'

type User = components['schemas']['User']

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const u = await get<User>('/me')
      setUser(u)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
  }, [refresh])

  const login = useCallback(
    async (email: string, password: string) => {
      await post('/auth/login', { email, password })
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout')
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
