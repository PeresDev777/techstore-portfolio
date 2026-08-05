/**
 * Contratos do domínio de usuário.
 *
 * `User` é o que a aplicação conhece sobre a pessoa logada — repare que NÃO existe
 * campo de senha aqui. A senha vive apenas na camada de dados (`data/users.ts`) e nunca
 * atravessa a fronteira do serviço, espelhando o que um backend real devolveria.
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

/** Resposta de uma autenticação bem-sucedida. */
export interface AuthSession {
  user: User
  token: string
}
