/**
 * Códigos de erro que a camada de serviços pode emitir.
 *
 * Usamos um objeto `as const` + union derivada em vez de `enum`: enums não são
 * apagáveis em tempo de compilação (violam `erasableSyntaxOnly`) e geram código em
 * runtime. Esta forma dá o mesmo autocomplete com custo zero no bundle.
 */
export const API_ERROR_CODE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  NOT_FOUND: 'NOT_FOUND',
  NETWORK: 'NETWORK',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE]

/**
 * Erro tipado da camada de serviços.
 *
 * Carregar um `code` — e não apenas uma string — permite que a UI decida a mensagem e o
 * tratamento sem comparar textos. Se amanhã a copy mudar, nenhuma lógica quebra.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** Type guard — `catch` entrega `unknown`, então precisamos estreitar o tipo com segurança. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
