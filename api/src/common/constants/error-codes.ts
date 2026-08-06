/**
 * Codigos de erro da API.
 *
 * Por que um codigo alem da mensagem? Porque `message` e texto para humano — muda com
 * revisao de copy, muda com traducao, muda com o humor do PM. O cliente precisa decidir
 * comportamento (renderizar erro no campo, redirecionar para login, oferecer retry) sem
 * comparar strings.
 *
 * O frontend ja opera assim: `frontend/src/services/apiError.ts` decide por `code`. Os
 * valores abaixo sao um SUPERCONJUNTO dos que ele ja conhece, de proposito — a migracao
 * do mock para a API real nao exige reescrever o tratamento de erro da UI.
 *
 * Para a automacao, e a diferenca entre asseverar `body.code === 'INSUFFICIENT_STOCK'`
 * (estavel) e asseverar a frase exibida (quebra na proxima revisao de texto).
 */
export const ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

/**
 * Codigo padrao por status HTTP, usado quando a excecao nao declarou o seu.
 * Garante que TODA resposta de erro tenha `code` — um campo que as vezes existe e as
 * vezes nao e pior que campo nenhum, porque o cliente precisa tratar os dois casos.
 */
export function defaultCodeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
    case 422:
      return ERROR_CODE.VALIDATION_ERROR
    case 401:
      return ERROR_CODE.UNAUTHENTICATED
    case 403:
      return ERROR_CODE.FORBIDDEN
    case 404:
      return ERROR_CODE.NOT_FOUND
    case 409:
      return ERROR_CODE.CONFLICT
    case 429:
      return ERROR_CODE.RATE_LIMITED
    case 503:
      return ERROR_CODE.SERVICE_UNAVAILABLE
    default:
      return ERROR_CODE.INTERNAL_ERROR
  }
}
