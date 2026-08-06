/**
 * Regras de frete.
 *
 * Valores replicados de `frontend/src/contexts/cartReducer.ts` e asseverados pela suite
 * (`automation/data/products.ts` -> `SHIPPING`). Sao contrato, nao parametro solto.
 */
export const SHIPPING_COST_IN_CENTS = 2990
export const FREE_SHIPPING_THRESHOLD_IN_CENTS = 50000

export interface TotalizableItem {
  priceInCents: number
  quantity: number
}

export interface CartTotals {
  /** Soma das QUANTIDADES — o numero do badge no cabecalho. */
  itemCount: number
  /** Quantidade de LINHAS distintas. */
  lineCount: number
  subtotal: number
  shipping: number
  total: number
}

/**
 * Calcula os totais do carrinho.
 *
 * Funcao PURA, sem Prisma, sem Nest, sem `this`: recebe uma lista e devolve numeros. E a
 * camada onde um teste unitario rende mais por linha — as combinacoes de frete gratis,
 * carrinho vazio e limite exato sao verificaveis chamando esta funcao, sem banco nem HTTP.
 *
 * Tudo em CENTAVOS ate o fim. A divisao por 100 acontece so na formatacao, na borda da UI.
 */
export function calculateTotals(items: TotalizableItem[]): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.priceInCents * item.quantity, 0)

  /*
   * Carrinho vazio nao paga frete — a condicao existe separada do limite de propósito.
   * Sem ela, um carrinho sem itens teria subtotal 0, que e menor que o limite, e o total
   * apareceria como R$ 29,90 de frete sobre nada.
   */
  const shipping =
    items.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD_IN_CENTS ? 0 : SHIPPING_COST_IN_CENTS

  return { itemCount, lineCount: items.length, subtotal, shipping, total: subtotal + shipping }
}
