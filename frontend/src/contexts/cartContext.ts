import { createContext } from 'react'

import type { CartItem, CartTotals } from '@/types/cart'
import type { Product } from '@/types/product'

export interface CartContextValue {
  items: CartItem[]
  totals: CartTotals
  /**
   * `true` enquanto o carrinho persistido ainda está sendo carregado.
   *
   * Sem esse sinal, qualquer tela que decida algo com base em "carrinho vazio" decide
   * cedo demais: no primeiro render após um load completo os itens ainda não chegaram.
   * É o mesmo problema — e a mesma solução — de `isRestoringSession` na autenticação.
   */
  isHydrating: boolean
  /** Quantidade já no carrinho para um produto — 0 se ausente. */
  getQuantity: (productId: string) => number
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)
