import type { CartItem, CartTotals } from '@/types/cart'

/** Dados pessoais do comprador. Documentos e telefone guardados sem máscara. */
export interface Customer {
  fullName: string
  email: string
  /** Somente dígitos. */
  cpf: string
  /** Somente dígitos. */
  phone: string
}

export interface Address {
  /** Somente dígitos. */
  zipCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  /** Sigla de duas letras. */
  state: string
}

export interface Order {
  /** Número legível exibido ao cliente, ex.: `TS-4F2A9C`. */
  id: string
  createdAt: string
  customer: Customer
  address: Address
  /** Snapshot dos itens no momento da compra — o carrinho é esvaziado em seguida. */
  items: CartItem[]
  totals: CartTotals
}

/**
 * Payload enviado ao serviço de pedidos.
 *
 * Repare no que NAO esta aqui: itens, precos e totais. Eles saem do carrinho NO SERVIDOR,
 * e o preco e lido do banco dentro da transacao de fechamento.
 *
 * Nao e simplificacao — e seguranca. Se o cliente enviasse a lista, enviaria tambem os
 * valores, e um pedido de R$ 0,01 seria aceito. O cliente escolhe o que comprar; o
 * servidor decide quanto custa.
 */
export interface CreateOrderInput {
  customer: Customer
  address: Address
}

/**
 * Unidades federativas, para o seletor de estado.
 * `prettier-ignore` mantém a lista em linhas compactas em vez de 27 linhas de uma sigla.
 */
// prettier-ignore
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
