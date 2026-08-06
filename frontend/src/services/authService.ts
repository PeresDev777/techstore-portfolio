import { request, writeSession } from '@/services/http'
import type { AuthSession, Credentials, User } from '@/types/user'

/**
 * Serviço de autenticação.
 *
 * Único ponto da aplicação que conhece as rotas de sessão da API. Componentes e contextos
 * falam com este módulo — nenhum deles monta uma requisição.
 */

interface LoginResponse {
  user: User
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export async function login(credentials: Credentials): Promise<AuthSession> {
  /*
   * `skipAuthRetry`: um 401 aqui significa credencial errada, não sessão expirada.
   * Sem isso, o cliente tentaria renovar uma sessão que ainda nem existe.
   */
  const data = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email: credentials.email.trim(), password: credentials.password },
    skipAuthRetry: true,
  })

  const session: AuthSession = {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  }

  writeSession(session)

  return session
}

/**
 * Encerra a sessão NO SERVIDOR. Não toca no armazenamento local.
 *
 * A API revoga a FAMÍLIA inteira de refresh tokens, não apenas o apresentado — sair
 * significa encerrar a sessão, e o token em mãos é só o elo mais recente da linhagem.
 *
 * **O token chega por parâmetro, e isso é a correção de um defeito real.** Antes esta
 * função lia o refresh token do storage e o limpava num `finally` — ou seja, a limpeza
 * local só acontecia DEPOIS da ida e volta de rede, ao contrário do que o ADR-012 promete.
 * Na janela entre o clique em "sair" e a resposta do servidor, o `localStorage` ainda
 * guardava uma sessão válida, e qualquer navegação (F5, fechar e reabrir a aba, um link)
 * a restaurava: o usuário pedia para sair e continuava dentro.
 *
 * Recebendo o token pronto, esta função deixa de ter opinião sobre armazenamento — quem
 * encerra a sessão local é o `AuthProvider`, antes de chamar aqui.
 *
 * A rota é pública: a prova de identidade é o próprio refresh token no corpo, não o
 * access token no header. Por isso ela funciona mesmo com a sessão local já apagada.
 */
export async function logout(refreshToken: string): Promise<void> {
  await request<null>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    skipAuthRetry: true,
  })
}

/**
 * Revalida a sessão restaurada do armazenamento local.
 *
 * `GET /auth/me` faz a verificação de verdade: a API confere assinatura, expiração E o
 * estado atual da conta no banco. Uma sessão adulterada no `localStorage`, de um usuário
 * removido ou de uma conta desativada é recusada — confiar cegamente no storage
 * permitiria forjar uma sessão editando o navegador.
 *
 * Se o access token estiver vencido, o `http.ts` renova e repete automaticamente. É por
 * isso que a sessão sobrevive a horas com a aba fechada.
 */
export function validateSession(): Promise<User> {
  return request<User>('/auth/me')
}
