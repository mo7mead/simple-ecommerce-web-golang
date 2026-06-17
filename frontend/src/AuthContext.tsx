import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type User, type SiteSettings } from './api'

interface AuthState {
  user: User | null
  settings: SiteSettings | null
  loading: boolean
  refresh: () => Promise<void>
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setUser: (u: User | null) => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const [meRes, settingsRes] = await Promise.all([api.me(), api.settings()])
      setUser(meRes.user)
      setSettings(settingsRes)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const signIn = async (username: string, password: string) => {
    const res = await api.login(username, password)
    setUser(res.user)
  }

  const signOut = async () => {
    await api.logout()
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, settings, loading, refresh, signIn, signOut, setUser }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be inside AuthProvider')
  return v
}
