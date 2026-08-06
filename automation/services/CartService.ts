import type { ApiClient } from '@services/ApiClient'
import type { ApiResponse, CartPayload } from '@services/types'

/**
 * Carrinho do usuario autenticado.
 *
 * Nenhum metodo recebe id de carrinho ou de usuario, e isso e um fato do DESENHO da API,
 * nao uma simplificacao daqui: o carrinho e sempre o de quem apresenta o token. O
 * isolamento entre contas e estrutural — nao ha parametro para adulterar.
 *
 * A consequencia para o teste e util de registrar: nao existe "buscar o carrinho de outro
 * usuario" para asseverar 403. O cenario de isolamento se escreve com DOIS clientes
 * autenticados, cada um com o seu token, provando que um nao ve o item do outro.
 */
export class CartService {
  constructor(private readonly api: ApiClient) {}

  get(): Promise<ApiResponse<CartPayload>> {
    return this.api.get<CartPayload>('/cart')
  }

  /** Produto repetido SOMA a quantidade; o limite de estoque vale sobre a soma (ADR-037). */
  addItem(productId: string, quantity = 1): Promise<ApiResponse<CartPayload>> {
    return this.api.post<CartPayload>('/cart/items', { productId, quantity })
  }

  /**
   * Quantidade ABSOLUTA, nunca incremento. Minimo 1 — zero responde 422.
   *
   * Aceitar zero criaria dois caminhos para remover e um verbo mentiroso: um update que
   * apaga o recurso que deveria atualizar. Existe `DELETE` para isso.
   */
  updateItem(productId: string, quantity: number): Promise<ApiResponse<CartPayload>> {
    return this.api.patch<CartPayload>(`/cart/items/${productId}`, { quantity })
  }

  removeItem(productId: string): Promise<ApiResponse<CartPayload>> {
    return this.api.delete<CartPayload>(`/cart/items/${productId}`)
  }

  clear(): Promise<ApiResponse<CartPayload>> {
    return this.api.delete<CartPayload>('/cart')
  }
}
