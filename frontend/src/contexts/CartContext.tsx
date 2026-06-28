import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Product } from '../api'

export interface CartItem {
  id: number
  name: string
  price: number
  imagePath: string
  qty: number
  stock: number
}

interface CartApi {
  items: CartItem[]
  count: number
  total: number
  add(p: Product, qty?: number): void
  setQty(id: number, qty: number): void
  remove(id: number): void
  clear(): void
}

const CartCtx = createContext<CartApi | null>(null)
const STORAGE_KEY = 'cart.v1'

export function useCart(): CartApi {
  const v = useContext(CartCtx)
  if (!v) throw new Error('useCart must be used inside <CartProvider>')
  return v
}

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => load())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const add = useCallback((p: Product, qty = 1) => {
    setItems(prev => {
      const i = prev.findIndex(x => x.id === p.id)
      if (i >= 0) {
        const next = prev.slice()
        const capped = Math.min(p.stock, next[i].qty + qty)
        next[i] = { ...next[i], qty: capped, stock: p.stock }
        return next
      }
      return [...prev, {
        id: p.id, name: p.name, price: p.price, imagePath: p.imagePath,
        qty: Math.min(p.stock, qty), stock: p.stock,
      }]
    })
  }, [])

  const setQty = useCallback((id: number, qty: number) => {
    setItems(prev =>
      qty <= 0
        ? prev.filter(x => x.id !== id)
        : prev.map(x => (x.id === id ? { ...x, qty: Math.min(qty, x.stock) } : x)),
    )
  }, [])

  const remove = useCallback((id: number) => {
    setItems(prev => prev.filter(x => x.id !== id))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const api = useMemo<CartApi>(() => ({
    items,
    count: items.reduce((n, x) => n + x.qty, 0),
    total: items.reduce((s, x) => s + x.price * x.qty, 0),
    add, setQty, remove, clear,
  }), [items, add, setQty, remove, clear])

  return <CartCtx.Provider value={api}>{children}</CartCtx.Provider>
}
