import type { CartAction, CartItem, CartState, CartTotals } from '@/types/cart'

/**
 * Redutor do carrinho.
 *
 * Função PURA e isolada do React de propósito: toda a regra de negócio do carrinho
 * (limite de estoque, remoção por quantidade zero, mesclagem de item repetido) pode ser
 * verificada chamando esta função com um estado e uma ação, sem montar componente nem
 * abrir navegador. É a camada onde um teste unitário rende mais por linha escrita.
 */

export const EMPTY_CART: CartState = { items: [] }

/** Frete fixo em centavos. */
export const SHIPPING_COST = 2990

/** Acima deste subtotal o frete é gratuito. */
export const FREE_SHIPPING_THRESHOLD = 50000

/**
 * Mantém a quantidade dentro do intervalo permitido.
 * Nunca acima do estoque disponível, nunca abaixo de zero.
 */
function clampToStock(quantity: number, stock: number): number {
  return Math.max(0, Math.min(quantity, stock))
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Produto sem estoque nunca entra no carrinho, venha o clique de onde vier.
      if (action.product.stock === 0) return state

      const existing = state.items.find((item) => item.product.id === action.product.id)

      if (!existing) {
        const quantity = clampToStock(action.quantity, action.product.stock)
        if (quantity === 0) return state
        return { items: [...state.items, { product: action.product, quantity }] }
      }

      /*
       * Item repetido soma à quantidade existente em vez de criar uma segunda linha.
       * O clamp é aplicado sobre a SOMA: adicionar 3 a um item que já tem 2, com estoque
       * de 4, resulta em 4 — não em 5.
       */
      const merged = clampToStock(existing.quantity + action.quantity, action.product.stock)

      return {
        items: state.items.map((item) =>
          item.product.id === action.product.id ? { ...item, quantity: merged } : item,
        ),
      }
    }

    case 'UPDATE_QUANTITY': {
      const target = state.items.find((item) => item.product.id === action.productId)
      if (!target) return state

      const quantity = clampToStock(action.quantity, target.product.stock)

      // Zerar a quantidade equivale a remover: evita item fantasma com quantidade 0.
      if (quantity === 0) {
        return { items: state.items.filter((item) => item.product.id !== action.productId) }
      }

      return {
        items: state.items.map((item) =>
          item.product.id === action.productId ? { ...item, quantity } : item,
        ),
      }
    }

    case 'REMOVE_ITEM':
      return { items: state.items.filter((item) => item.product.id !== action.productId) }

    case 'CLEAR':
      return EMPTY_CART

    case 'REPLACE':
      return { items: action.items }

    default:
      /*
       * `never` faz o TypeScript falhar a compilação se uma ação nova for adicionada ao
       * tipo `CartAction` sem tratamento aqui. O compilador vira a rede de segurança.
       */
      return assertNeverAction(action)
  }
}

function assertNeverAction(action: never): never {
  throw new Error(`Ação de carrinho não tratada: ${JSON.stringify(action)}`)
}

/**
 * Calcula os totais a partir dos itens.
 *
 * Tudo em centavos (inteiro) até o fim — a divisão por 100 acontece só na formatação.
 */
export function calculateTotals(state: CartState): CartTotals {
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = state.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const shipping =
    state.items.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST

  return {
    itemCount,
    lineCount: state.items.length,
    subtotal,
    shipping,
    total: subtotal + shipping,
  }
}

/**
 * Valida itens vindos do localStorage antes de reidratar o estado.
 *
 * Dados persistidos são entrada não confiável: podem ter sido editados à mão ou gravados
 * por uma versão anterior com outro formato. Um item malformado é descartado em vez de
 * derrubar a aplicação inteira no boot.
 */
export function parseStoredItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is CartItem => {
    if (typeof item !== 'object' || item === null) return false

    const candidate = item as Partial<CartItem>
    const product = candidate.product

    return (
      typeof product === 'object' &&
      product !== null &&
      typeof product.id === 'string' &&
      typeof product.price === 'number' &&
      typeof candidate.quantity === 'number' &&
      candidate.quantity > 0
    )
  })
}
