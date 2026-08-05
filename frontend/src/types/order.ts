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

/** Payload enviado ao serviço de pedidos. */
export interface CreateOrderInput {
  customer: Customer
  address: Address
  items: CartItem[]
  totals: CartTotals
}

/** Unidades federativas, para o seletor de estado. */
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
