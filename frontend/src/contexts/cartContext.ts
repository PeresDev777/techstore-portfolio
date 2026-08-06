import { createContext } from 'react'

import type { CartItem, CartTotals } from '@/types/cart'
import type { Product } from '@/types/product'

export interface CartContextValue {
  items: CartItem[]
  totals: CartTotals
  /**
   * `true` enquanto o carrinho ainda está sendo carregado do servidor.
   *
   * Sem esse sinal, qualquer tela que decida algo com base em "carrinho vazio" decide
   * cedo demais: no primeiro render após um load completo os itens ainda não chegaram.
   * É o mesmo problema — e a mesma solução — de `isRestoringSession` na autenticação.
   */
  isHydrating: boolean
  /**
   * Falha da última operação, ou `null`.
   *
   * Existe porque o carrinho passou a ser remoto: a API pode recusar o que a UI já
   * aplicou de forma otimista (estoque acabou entre o clique e a requisição). Sem este
   * campo, a mudança seria revertida na tela sem explicação nenhuma.
   */
  error: string | null
  /** Quantidade já no carrinho para um produto — 0 se ausente. */
  getQuantity: (productId: string) => number
  /*
   * As operações passaram a devolver `Promise` — elas conversam com a API. Quem chama
   * pode continuar ignorando o retorno (a UI já foi atualizada de forma otimista) ou
   * aguardar, quando precisa do resultado confirmado antes de seguir.
   */
  addItem: (product: Product, quantity?: number) => Promise<void>
  removeItem: (productId: string) => Promise<void>
  updateQuantity: (productId: string, quantity: number) => Promise<void>
  clear: () => Promise<void>
  /**
   * Limpa apenas o estado local, sem chamar a API.
   *
   * Usado após fechar um pedido: a API já consumiu o carrinho dentro da mesma transação
   * que criou o pedido. Um `DELETE /cart` em seguida seria uma requisição para apagar
   * algo que não existe mais.
   */
  clearLocal: () => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)
