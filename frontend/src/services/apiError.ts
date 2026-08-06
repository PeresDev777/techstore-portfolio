/**
 * Códigos de erro que a camada de serviços pode emitir.
 *
 * Usamos um objeto `as const` + union derivada em vez de `enum`: enums não são
 * apagáveis em tempo de compilação (violam `erasableSyntaxOnly`) e geram código em
 * runtime. Esta forma dá o mesmo autocomplete com custo zero no bundle.
 *
 * Os valores espelham os códigos da API (`api/src/common/constants/error-codes.ts`).
 * Isso não é coincidência: a API foi desenhada com um SUPERCONJUNTO dos códigos que o
 * mock já emitia, justamente para que a integração não obrigasse a reescrever o
 * tratamento de erro da UI.
 */
export const API_ERROR_CODE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  NOT_FOUND: 'NOT_FOUND',
  NETWORK: 'NETWORK',

  // Acrescentados na integração com a API real.
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  /**
   * Código que esta versão do cliente não conhece.
   *
   * Existe para que uma API em evolução não quebre um cliente antigo: um código novo cai
   * no tratamento genérico em vez de estourar. Sem isso, acrescentar um código à API
   * exigiria coordenar deploy com o frontend.
   */
  UNKNOWN: 'UNKNOWN',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE]

/** Erro por campo, como a API devolve em `errors[]`. */
export interface FieldError {
  field: string
  message: string
}

/**
 * Erro tipado da camada de serviços.
 *
 * Carregar um `code` — e não apenas uma string — permite que a UI decida a mensagem e o
 * tratamento sem comparar textos. Se amanhã a copy mudar, nenhuma lógica quebra.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  /** Detalhamento por campo, presente quando o erro é de validação. */
  readonly errors: FieldError[]

  constructor(code: ApiErrorCode, message: string, errors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.errors = errors
  }

  /** Mensagem de um campo específico, para exibir junto do input correspondente. */
  fieldError(field: string): string | undefined {
    return this.errors.find((error) => error.field === field)?.message
  }
}

/** Type guard — `catch` entrega `unknown`, então precisamos estreitar o tipo com segurança. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
