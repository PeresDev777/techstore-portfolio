import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'

import { CartContext, type CartContextValue } from '@/contexts/cartContext'
import { calculateTotals, cartReducer, EMPTY_CART } from '@/contexts/cartReducer'
import { useAuth } from '@/hooks/useAuth'
import { isApiError } from '@/services/apiError'
import * as cartService from '@/services/cartService'
import type { CartTotals } from '@/types/cart'
import type { Product } from '@/types/product'

/**
 * Provider de carrinho — cache otimista sobre a API.
 *
 * O carrinho saiu do `localStorage` e passou a viver no servidor. O redutor puro
 * (`cartReducer`) NÃO foi descartado: ele continua sendo a fonte da resposta imediata na
 * tela, aplicada antes de a requisição voltar.
 *
 * O desenho é o "optimistic update" clássico:
 *
 *   1. aplica a ação localmente pelo redutor  → a UI responde na hora
 *   2. envia para a API                       → o servidor decide de verdade
 *   3. substitui o estado pela resposta       → converge para a fonte da verdade
 *   4. em caso de erro, ressincroniza         → o otimismo é desfeito
 *
 * Preserva três coisas de uma vez: a sensação de instantaneidade, os testes unitários do
 * redutor (a regra local não mudou) e a autoridade do servidor sobre estoque e preço.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isRestoringSession } = useAuth()
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART)
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Totais vindos do servidor.
   *
   * `null` durante a janela otimista, quando o cálculo local assume. As duas
   * implementações seguem a MESMA regra de frete — mas o servidor tem uma informação que
   * o cliente não tem: itens indisponíveis ficam fora do total. Por isso ele vence
   * sempre que existe.
   */
  const [serverTotals, setServerTotals] = useState<CartTotals | null>(null)

  const userId = user?.id ?? null

  const applySnapshot = useCallback((snapshot: cartService.CartSnapshot) => {
    dispatch({ type: 'REPLACE', items: snapshot.items })
    setServerTotals(snapshot.totals)
  }, [])

  /**
   * Ressincroniza a partir do servidor.
   *
   * Chamado quando uma operação falha: o estado otimista pode estar errado (o estoque
   * acabou, o produto saiu de catálogo), e adivinhar o que o servidor fez seria pior do
   * que perguntar.
   */
  const resync = useCallback(async () => {
    try {
      applySnapshot(await cartService.getCart())
    } catch {
      // Se nem a leitura funciona, manter o que está na tela é melhor que esvaziá-la.
    }
  }, [applySnapshot])

  /*
   * Carrega o carrinho ao entrar; esvazia ao sair.
   *
   * Enquanto a sessão está sendo restaurada ainda não se sabe QUAL carrinho carregar —
   * concluir a hidratação aqui reportaria "carrinho vazio" para uma conta que tem itens,
   * e o checkout expulsaria justamente quem tinha o que comprar (ADR-015).
   */
  useEffect(() => {
    if (isRestoringSession) return

    if (!userId) {
      dispatch({ type: 'CLEAR' })
      setServerTotals(null)
      setIsCartLoaded(true)
      return
    }

    let isCurrent = true
    setIsCartLoaded(false)

    cartService
      .getCart()
      .then((snapshot) => {
        if (isCurrent) applySnapshot(snapshot)
      })
      .catch(() => {
        if (isCurrent) dispatch({ type: 'CLEAR' })
      })
      .finally(() => {
        if (isCurrent) setIsCartLoaded(true)
      })

    /*
     * O flag descarta a resposta de um usuário que já não é o atual. Sem ele, trocar de
     * conta rapidamente carregaria o carrinho do usuário anterior por cima do novo — o
     * mesmo vazamento entre contas que o ADR-012 fechou na versão local.
     */
    return () => {
      isCurrent = false
    }
  }, [userId, isRestoringSession, applySnapshot])

  /** Envolve uma operação: otimismo, envio, convergência e tratamento de falha. */
  const run = useCallback(
    async (optimistic: () => void, call: () => Promise<cartService.CartSnapshot>) => {
      setError(null)
      optimistic()
      // Enquanto não há resposta, os totais saem do cálculo local.
      setServerTotals(null)

      try {
        applySnapshot(await call())
      } catch (caught: unknown) {
        setError(isApiError(caught) ? caught.message : 'Não foi possível atualizar o carrinho.')
        await resync()
      }
    },
    [applySnapshot, resync],
  )

  const getQuantity = useCallback(
    (productId: string) => state.items.find((item) => item.product.id === productId)?.quantity ?? 0,
    [state.items],
  )

  const addItem = useCallback(
    async (product: Product, quantity = 1) => {
      await run(
        () => dispatch({ type: 'ADD_ITEM', product, quantity }),
        () => cartService.addItem(product.id, quantity),
      )
    },
    [run],
  )

  const removeItem = useCallback(
    async (productId: string) => {
      await run(
        () => dispatch({ type: 'REMOVE_ITEM', productId }),
        () => cartService.removeItem(productId),
      )
    },
    [run],
  )

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      await run(
        () => dispatch({ type: 'UPDATE_QUANTITY', productId, quantity }),
        () => cartService.updateQuantity(productId, quantity),
      )
    },
    [run],
  )

  const clear = useCallback(async () => {
    await run(
      () => dispatch({ type: 'CLEAR' }),
      () => cartService.clearCart(),
    )
  }, [run])

  /**
   * Limpa apenas o estado local, sem chamar a API.
   *
   * Usado depois de fechar um pedido: a API já consumiu o carrinho dentro da mesma
   * transação que criou o pedido.
   */
  const clearLocal = useCallback(() => {
    dispatch({ type: 'CLEAR' })
    setServerTotals(null)
    setError(null)
  }, [])

  // Cálculo local: vale na janela otimista, até a resposta do servidor chegar.
  const localTotals = useMemo(() => calculateTotals(state), [state])
  const totals = serverTotals ?? localTotals

  const isHydrating = isRestoringSession || !isCartLoaded

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      totals,
      isHydrating,
      error,
      getQuantity,
      addItem,
      removeItem,
      updateQuantity,
      clear,
      clearLocal,
    }),
    [
      state.items,
      totals,
      isHydrating,
      error,
      getQuantity,
      addItem,
      removeItem,
      updateQuantity,
      clear,
      clearLocal,
    ],
  )

  return <CartContext value={value}>{children}</CartContext>
}
