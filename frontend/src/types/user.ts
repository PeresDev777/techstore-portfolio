/**
 * Contratos do domínio de usuário.
 *
 * `User` é o que a aplicação conhece sobre a pessoa logada — repare que NÃO existe
 * campo de senha aqui. A senha nunca atravessa a fronteira do serviço, espelhando o que
 * a API devolve.
 */
export interface User {
  id: string
  name: string
  email: string
}

/** Dados enviados no formulário de login. */
export interface Credentials {
  email: string
  password: string
}

/**
 * Sessão autenticada.
 *
 * Dois tokens, e a razão está no ADR-025 da API: o `accessToken` é um JWT curto (15 min)
 * que o servidor NÃO consegue revogar, e o `refreshToken` é opaco, guardado no banco e
 * revogável — é ele que torna o logout real.
 *
 * O cliente guarda os dois no `localStorage` porque a sessão precisa sobreviver ao
 * reload. É também o que permite ao Playwright capturar a sessão via `storageState`.
 */
export interface AuthSession {
  user: User
  accessToken: string
  refreshToken: string
}
