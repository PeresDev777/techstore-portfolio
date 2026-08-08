import type { ApiClient } from '@services/ApiClient'
import type { ApiResponse, ProductPayload } from '@services/types'

/**
 * Consulta ao catalogo.
 *
 * `sort` e deliberadamente `string` e nao uma uniao fechada: um dos cenarios que so a API
 * alcanca e justamente `?sort=lixo` responder 422. Tipar o parametro impediria o teste de
 * ser escrito — o TypeScript recusaria o valor invalido antes de a API opinar.
 */
export interface ProductQuery {
  search?: string
  category?: string
  inStock?: boolean
  sort?: string
  page?: number
  limit?: number
}

export interface CreateProductInput {
  name: string
  brand: string
  description: string
  priceInCents: number
  category: string
  imageUrl: string
  stock: number
  [extra: string]: unknown
}

export class ProductService {
  constructor(private readonly api: ApiClient) {}

  list(query: ProductQuery = {}): Promise<ApiResponse<ProductPayload[]>> {
    return this.api.get<ProductPayload[]>('/products', { query: { ...query } })
  }

  /** A rota aceita id OU slug — os dois caminhos precisam resolver o mesmo produto. */
  findOne(idOrSlug: string): Promise<ApiResponse<ProductPayload>> {
    return this.api.get<ProductPayload>(`/products/${idOrSlug}`)
  }

  related(idOrSlug: string): Promise<ApiResponse<ProductPayload[]>> {
    return this.api.get<ProductPayload[]>(`/products/${idOrSlug}/related`)
  }

  // --- rotas de administrador ---------------------------------------------
  //
  // Nao existe caminho de navegador para nenhuma delas: o frontend nao tem tela
  // administrativa. Sao alcancaveis apenas por HTTP — e por isso mesmo sao onde vivem os
  // cenarios de autorizacao e de imutabilidade de snapshot.

  create(input: Partial<CreateProductInput>): Promise<ApiResponse<ProductPayload>> {
    return this.api.post<ProductPayload>('/products', input)
  }

  update(id: string, input: Record<string, unknown>): Promise<ApiResponse<ProductPayload>> {
    return this.api.patch<ProductPayload>(`/products/${id}`, input)
  }

  remove(id: string): Promise<ApiResponse<null>> {
    return this.api.delete<null>(`/products/${id}`)
  }
}
