import type { ApiClient } from '@services/ApiClient'
import type { ApiResponse, SessionPayload, UserPayload } from '@services/types'

export interface Credentials {
  email: string
  password: string
}

/**
 * Rotas de sessao.
 *
 * Os metodos devolvem a resposta CRUA, nunca `data` desembrulhado nem um erro lancado.
 * Metade do trabalho de uma suite de API e asseverar 401, 403 e 422 — um service que so
 * soubesse devolver o caminho feliz obrigaria cada teste negativo a contorna-lo, e a camada
 * deixaria de servir justamente aos testes que mais precisam dela.
 *
 * Quem decide se a resposta esta certa e o teste, via `utils/assertions`. O service so
 * conhece a ROTA.
 */
export class AuthService {
  constructor(private readonly api: ApiClient) {}

  register(user: {
    name: string
    email: string
    password: string
  }): Promise<ApiResponse<UserPayload>> {
    return this.api.post<UserPayload>('/auth/register', user)
  }

  /**
   * Envia SOMENTE os campos que o `LoginDto` declara.
   *
   * Nao e zelo estetico. A massa de `data/users.ts` carrega `id`, `name` e `role` para os
   * testes poderem asseverar sobre eles, e repassar o objeto inteiro faz o
   * `forbidNonWhitelisted` (ADR-024) responder 422 — a protecao contra mass assignment
   * funcionando exatamente como deve, contra a propria suite.
   *
   * O caso descoberto assim: a fixture de admin quebrou com 422 num cenario que nao tinha
   * nada a ver com validacao. Quem quiser TESTAR o campo extra manda pelo `api.post` cru;
   * o service e o caminho do uso correto.
   */
  login(credentials: Credentials): Promise<ApiResponse<SessionPayload>> {
    return this.api.post<SessionPayload>('/auth/login', {
      email: credentials.email,
      password: credentials.password,
    })
  }

  /**
   * Troca o refresh token por um par novo. O apresentado e QUEIMADO.
   *
   * Reapresentar um token ja rotacionado revoga a familia inteira (ADR-025) — o cenario de
   * deteccao de roubo, que so existe por HTTP: o cliente do navegador foi escrito com
   * `refreshInFlight` justamente para nunca produzir essa chamada.
   */
  refresh(refreshToken: string): Promise<ApiResponse<SessionPayload>> {
    return this.api.post<SessionPayload>('/auth/refresh', { refreshToken })
  }

  /** Revoga a familia inteira, nao apenas o elo apresentado. */
  logout(refreshToken: string): Promise<ApiResponse<null>> {
    return this.api.post<null>('/auth/logout', { refreshToken })
  }

  me(): Promise<ApiResponse<UserPayload>> {
    return this.api.get<UserPayload>('/auth/me')
  }

  /**
   * Autentica e devolve os tokens, estourando se falhar.
   *
   * Existe para PREPARAR estado — uma fixture que precisa de um token nao esta testando o
   * login. A separacao e proposital: `login()` devolve a resposta para ser asseverada,
   * `authenticate()` devolve a sessao para ser usada. Misturar as duas produziria um
   * service que as vezes lanca e as vezes nao, dependendo de como foi chamado.
   */
  async authenticate(credentials: Credentials): Promise<SessionPayload> {
    const response = await this.login(credentials)

    if (!response.ok || !response.body?.success) {
      throw new Error(
        `Falha ao autenticar ${credentials.email} (status ${response.status}, ` +
          `x-request-id ${response.requestId ?? 'ausente'}). ` +
          `A API esta no ar e o seed foi aplicado?`,
      )
    }

    return response.body.data
  }
}
