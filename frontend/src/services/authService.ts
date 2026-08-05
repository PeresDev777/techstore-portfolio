import { USER_RECORDS } from '@/data/users'
import { API_ERROR_CODE, ApiError } from '@/services/apiError'
import { delay, respondWith } from '@/services/http'
import type { AuthSession, Credentials, User } from '@/types/user'

/**
 * Serviço de autenticação.
 *
 * Único ponto da aplicação que conhece a origem dos dados de usuário. Componentes e
 * contextos falam com este módulo, nunca com `data/users.ts` diretamente.
 */

/** Gera um token opaco. Formato irrelevante para o mock; o que importa é existir e ser único. */
function createToken(userId: string): string {
  return `mock.${userId}.${crypto.randomUUID()}`
}

/** Remove campos sensíveis do registro antes de devolvê-lo à aplicação. */
function toPublicUser(record: (typeof USER_RECORDS)[number]): User {
  const { id, name, email } = record
  return { id, name, email }
}

export async function login(credentials: Credentials): Promise<AuthSession> {
  await delay()

  const email = credentials.email.trim().toLowerCase()
  const record = USER_RECORDS.find((user) => user.email.toLowerCase() === email)

  /*
   * Mesma mensagem para "email inexistente" e "senha errada".
   * Diferenciar os dois casos permitiria a um atacante enumerar contas válidas —
   * é uma prática que um code review de segurança cobraria mesmo em um mock.
   */
  if (!record || record.password !== credentials.password) {
    throw new ApiError(API_ERROR_CODE.INVALID_CREDENTIALS, 'E-mail ou senha inválidos.')
  }

  if (!record.isActive) {
    throw new ApiError(
      API_ERROR_CODE.ACCOUNT_DISABLED,
      'Esta conta está desativada. Entre em contato com o suporte.',
    )
  }

  return { user: toPublicUser(record), token: createToken(record.id) }
}

export async function logout(): Promise<void> {
  // Em um backend real, invalidaria o token no servidor.
  await delay(150)
}

/**
 * Revalida um token de sessão restaurado do armazenamento local.
 * Garante que uma sessão adulterada ou de um usuário removido não seja aceita.
 */
export async function validateSession(session: AuthSession): Promise<User> {
  const record = USER_RECORDS.find((user) => user.id === session.user.id)

  if (!record || !record.isActive) {
    throw new ApiError(API_ERROR_CODE.NOT_FOUND, 'Sessão inválida.')
  }

  return respondWith(toPublicUser(record), 100)
}
