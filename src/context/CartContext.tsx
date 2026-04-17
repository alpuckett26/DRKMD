'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { CartItem, SubstitutionPreference } from '@/types'

interface CartState {
  storeId: string | null
  items: CartItem[]
  substitutionPreference: SubstitutionPreference
}

interface CartContextValue extends CartState {
  addItem: (item: Omit<CartItem, 'qty'>) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  setSubstitutionPreference: (pref: SubstitutionPreference) => void
  clearCart: () => void
  total: number
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'drkmd_cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({
    storeId: null,
    items: [],
    substitutionPreference: 'none',
  })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setState(JSON.parse(stored))
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state, hydrated])

  const addItem = useCallback((item: Omit<CartItem, 'qty'>) => {
    setState(prev => {
      const existing = prev.items.find(i => i.productId === item.productId)
      const items = existing
        ? prev.items.map(i =>
            i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i,
          )
        : [...prev.items, { ...item, qty: 1 }]
      return { ...prev, storeId: prev.storeId, items }
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.productId !== productId),
    }))
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    setState(prev => ({
      ...prev,
      items:
        qty <= 0
          ? prev.items.filter(i => i.productId !== productId)
          : prev.items.map(i =>
              i.productId === productId ? { ...i, qty } : i,
            ),
    }))
  }, [])

  const setSubstitutionPreference = useCallback(
    (pref: SubstitutionPreference) => {
      setState(prev => ({ ...prev, substitutionPreference: pref }))
    },
    [],
  )

  const clearCart = useCallback(() => {
    setState({ storeId: null, items: [], substitutionPreference: 'none' })
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const total = state.items.reduce((s, i) => s + i.price * i.qty, 0)
  const itemCount = state.items.reduce((s, i) => s + i.qty, 0)

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem,
        updateQty,
        setSubstitutionPreference,
        clearCart,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
