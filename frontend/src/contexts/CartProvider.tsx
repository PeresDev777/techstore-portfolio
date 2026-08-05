import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'

import { CartContext, type CartContextValue } from '@/contexts/cartContext'
import { calculateTotals, cartReducer, EMPTY_CART, parseStoredItems } from '@/contexts/cartReducer'
import { useAuth } from '@/hooks/useAuth'
import type { Product } from '@/types/product'
import { readJson, remove, writeJson } from '@/utils/storage'

/**
 * Chave de persistência por usuário.
 *
 * Sem o id na chave, dois usuários no mesmo navegador compartilhariam o carrinho — um
 * vazamento de dados entre contas que só aparece em teste com troca de login.
 */
function storageKey(userId: string): string {
  return `techstore:cart:${userId}`
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART)

  const userId = user?.id ?? null

  /*
   * Carrega o carrinho do usuário ao entrar e o esvazia ao sair.
   *
   * Depende de `userId` (string) e não do objeto `user`: um novo objeto com o mesmo id
   * dispararia a reidratação de novo e descartaria alterações não persistidas.
   */
  useEffect(() => {
    if (!userId) {
      dispatch({ type: 'CLEAR' })
      return
    }

    const stored = readJson<unknown>(storageKey(userId))
    dispatch({ type: 'REPLACE', items: parseStoredItems(stored) })
  }, [userId])

  /*
   * Persiste a cada mudança — exceto no primeiro render após a troca de usuário, quando o
   * estado ainda é o carrinho do usuário anterior. Gravar ali sobrescreveria o carrinho
   * salvo do novo usuário com um estado que não é dele.
   */
  const hydratedUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return

    if (hydratedUserRef.current !== userId) {
      hydratedUserRef.current = userId
      return
    }

    if (state.items.length === 0) {
      remove(storageKey(userId))
    } else {
      writeJson(storageKey(userId), state.items)
    }
  }, [state.items, userId])

  const getQuantity = useCallback(
    (productId: string) =>
      state.items.find((item) => item.product.id === productId)?.quantity ?? 0,
    [state.items],
  )

  const addItem = useCallback((product: Product, quantity = 1) => {
    dispatch({ type: 'ADD_ITEM', product, quantity })
  }, [])

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', productId })
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', productId, quantity })
  }, [])

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])

  // Totais recalculados só quando os itens mudam, não a cada render.
  const totals = useMemo(() => calculateTotals(state), [state])

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      totals,
      getQuantity,
      addItem,
      removeItem,
      updateQuantity,
      clear,
    }),
    [state.items, totals, getQuantity, addItem, removeItem, updateQuantity, clear],
  )

  return <CartContext value={value}>{children}</CartContext>
}
