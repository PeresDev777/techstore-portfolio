import { use } from 'react'

import { CartContext, type CartContextValue } from '@/contexts/cartContext'

export function useCart(): CartContextValue {
  const context = use(CartContext)

  if (context === undefined) {
    throw new Error('useCart deve ser usado dentro de um <CartProvider>.')
  }

  return context
}
