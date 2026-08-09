import type { ApiClient } from '@services/ApiClient'
import type { ApiResponse, UserPayload } from '@services/types'

/**
 * Perfil e administracao de usuarios.
 *
 * `GET /users` e `GET /users/:id` sao restritas a ADMIN e nao tem tela no frontend — sao o
 * par natural para os cenarios de autorizacao: um cliente autenticado recebe 403, e o
 * mesmo endpoint com token de admin recebe 200. Sem o segundo, o teste provaria apenas que
 * a rota recusa alguem, nao que ela funciona para quem pode.
 */
export class UserService {
  constructor(private readonly api: ApiClient) {}

  me(): Promise<ApiResponse<UserPayload>> {
    return this.api.get<UserPayload>('/users/me')
  }

  /**
   * Atualiza nome e/ou e-mail.
   *
   * Aceita chave arbitraria de proposito: o cenario de **mass assignment** manda
   * `{ role: 'ADMIN' }` e espera 422 pelo `forbidNonWhitelisted` (ADR-024). Um tipo fechado
   * aqui tornaria o teste impossivel de escrever — e e uma das escaladas de privilegio mais
   * comuns em API REST.
   */
  updateMe(input: Record<string, unknown>): Promise<ApiResponse<UserPayload>> {
    return this.api.patch<UserPayload>('/users/me', input)
  }

  changePassword(input: Record<string, unknown>): Promise<ApiResponse<null>> {
    return this.api.patch<null>('/users/me/password', input)
  }

  /** Exclusao logica; revoga as sessoes. */
  removeMe(): Promise<ApiResponse<null>> {
    return this.api.delete<null>('/users/me')
  }

  // --- administrador -------------------------------------------------------

  list(query: { page?: number; limit?: number } = {}): Promise<ApiResponse<UserPayload[]>> {
    return this.api.get<UserPayload[]>('/users', { query: { ...query } })
  }

  findOne(id: string): Promise<ApiResponse<UserPayload>> {
    return this.api.get<UserPayload>(`/users/${id}`)
  }
}
