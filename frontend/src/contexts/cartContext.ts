import { createContext } from 'react'

import type { CartItem, CartTotals } from '@/types/cart'
import type { Product } from '@/types/product'

export interface CartContextValue {
  items: CartItem[]
  totals: CartTotals
  /** Quantidade já no carrinho para um produto — 0 se ausente. */
  getQuantity: (productId: string) => number
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)
