import type { Product } from '@/types/product'

/**
 * Item do carrinho.
 *
 * Guarda um SNAPSHOT do produto, não apenas o id. Se o preço do catálogo mudar enquanto o
 * item já está no carrinho, o usuário continua vendo o valor pelo qual escolheu comprar —
 * é o comportamento que qualquer e-commerce sério tem, e evita a situação em que o total
 * muda sozinho entre a listagem e o checkout.
 */
export interface CartItem {
  product: Product
  quantity: number
}

export interface CartState {
  items: CartItem[]
}

/**
 * Totais derivados do carrinho.
 *
 * Calculados a partir dos itens, nunca armazenados: um total guardado em estado é uma
 * segunda fonte de verdade que pode divergir dos itens — bug clássico de carrinho.
 */
export interface CartTotals {
  /** Soma das quantidades — o número exibido no badge do cabeçalho. */
  itemCount: number
  /** Quantidade de linhas distintas no carrinho. */
  lineCount: number
  /** Subtotal em centavos. */
  subtotal: number
  /** Frete em centavos. */
  shipping: number
  /** Total em centavos. */
  total: number
}

/** Ações aceitas pelo redutor do carrinho. */
export type CartAction =
  | { type: 'ADD_ITEM'; product: Product; quantity: number }
  | { type: 'REMOVE_ITEM'; productId: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; quantity: number }
  | { type: 'CLEAR' }
  /** Usado para reidratar o carrinho persistido no boot. */
  | { type: 'REPLACE'; items: CartItem[] }
