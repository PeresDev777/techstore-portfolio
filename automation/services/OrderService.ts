import type { ApiClient } from '@services/ApiClient'
import type { ApiResponse, OrderPayload } from '@services/types'

export interface OrderCustomer {
  fullName: string
  email: string
  cpf: string
  phone: string
}

export interface OrderAddress {
  zipCode: string
  street: string
  number: string
  complement?: string
  district: string
  city: string
  state: string
}

export interface CreateOrderInput {
  customer: OrderCustomer
  address: OrderAddress
}

/**
 * Pedidos.
 *
 * **O corpo nao contem itens, e isso e a regra de seguranca mais importante da API.** Eles
 * vem do carrinho no servidor e o preco e lido do banco DENTRO da transacao. Se o cliente
 * enviasse a lista, enviaria tambem o preco — e um pedido de R$ 0,01 seria aceito.
 *
 * `CreateOrderInput` aceita `Partial` nas chamadas de validacao de proposito: os cenarios
 * de 422 precisam mandar corpo incompleto ou com campo aninhado invalido, e um tipo
 * fechado impediria o teste de existir.
 */
export class OrderService {
  constructor(private readonly api: ApiClient) {}

  create(input: DeepPartial<CreateOrderInput>): Promise<ApiResponse<OrderPayload>> {
    return this.api.post<OrderPayload>('/orders', input)
  }

  list(query: { page?: number; limit?: number } = {}): Promise<ApiResponse<OrderPayload[]>> {
    return this.api.get<OrderPayload[]>('/orders', { query: { ...query } })
  }

  /**
   * Pedido por id.
   *
   * Pedido de outro usuario responde **404, nunca 403**: um 403 confirmaria que o numero
   * existe, e a resposta viraria um oraculo para enumerar pedidos alheios. Nao ha tela de
   * pedidos no frontend, entao este cenario so existe por HTTP.
   */
  findOne(id: string): Promise<ApiResponse<OrderPayload>> {
    return this.api.get<OrderPayload>(`/orders/${id}`)
  }

  /** So a partir de PENDING; devolve o estoque. Pedido pago recusa — estorno nao existe. */
  cancel(id: string): Promise<ApiResponse<OrderPayload>> {
    return this.api.post<OrderPayload>(`/orders/${id}/cancel`)
  }

  /** Simulacao explicita (ADR-040): e o que torna PAID alcancavel e o conflito reproduzivel. */
  pay(id: string): Promise<ApiResponse<OrderPayload>> {
    return this.api.post<OrderPayload>(`/orders/${id}/pay`)
  }
}

/** Permite omitir campos aninhados nos cenarios de validacao. */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
