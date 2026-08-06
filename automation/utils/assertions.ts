import { expect } from '@playwright/test'

import type {
  ApiResponse,
  ErrorCode,
  ErrorEnvelope,
  Pagination,
  SuccessEnvelope,
} from '@services/types'

/**
 * O helper unico de assercao da suite de API.
 *
 * O ADR-022 tornou o envelope uma garantia ESTRUTURAL — um interceptor global, nao uma
 * convencao que alguem pode esquecer. O ADR-031 registrou a consequencia para o teste:
 * "um `expectSuccess(res)` serve a suite inteira". Este arquivo e essa promessa cumprida.
 *
 * Por que devolver `data` em vez de so asseverar: encadear a verificacao com a extracao
 * elimina a dupla `expectSuccess(res)` + `res.body.data!` que apareceria em todo teste — e
 * com ela o `!` que desliga justamente a checagem que acabou de ser feita.
 */

/** Contexto de falha. Sem isto, "esperava 200, recebeu 409" nao diz onde procurar. */
function describe(res: ApiResponse<unknown>): string {
  const body = res.body
  const code = body && !body.success ? ` code=${body.code}` : ''
  const message = body ? ` message=${JSON.stringify(body.message)}` : ' (corpo nao e JSON)'

  return `status=${res.status}${code}${message} x-request-id=${res.requestId ?? 'ausente'}`
}

/**
 * Assevera sucesso e devolve o `data` ja tipado.
 *
 * Verifica as tres coisas que definem uma resposta de sucesso, e nao apenas o status: um
 * 200 com `success: false` no corpo seria uma API se contradizendo, e o teste tem que
 * pegar isso.
 */
export function expectSuccess<T>(res: ApiResponse<T>, status = 200): T {
  expect(res.body, `resposta sem corpo JSON. ${describe(res)}`).not.toBeNull()
  expect(res.status, `status inesperado. ${describe(res)}`).toBe(status)
  expect(res.body?.success, `envelope com success=false. ${describe(res)}`).toBe(true)

  const body = res.body as SuccessEnvelope<T>

  expect(body.message, `envelope sem message. ${describe(res)}`).toEqual(expect.any(String))

  return body.data
}

/**
 * Assevera uma listagem paginada e devolve dado e paginacao.
 *
 * `totalPages` e conferido contra `total` e `limit` porque e um campo DERIVADO: a API pode
 * devolver os tres consistentes ou os tres plausiveis, e so o calculo distingue.
 */
export function expectPaginated<T>(
  res: ApiResponse<T[]>,
  expected: Partial<Pick<Pagination, 'page' | 'limit' | 'total'>> = {},
): { data: T[]; pagination: Pagination } {
  const data = expectSuccess(res)
  const pagination = (res.body as SuccessEnvelope<T[]>).pagination

  expect(pagination, `listagem sem paginacao. ${describe(res)}`).toBeDefined()
  expect(Array.isArray(data), `data deveria ser um array. ${describe(res)}`).toBe(true)

  const page = pagination as Pagination

  for (const [key, value] of Object.entries(expected)) {
    expect(page[key as keyof typeof expected], `pagination.${key} divergente`).toBe(value)
  }

  expect(page.totalPages, 'totalPages precisa ser derivado de total e limit').toBe(
    Math.ceil(page.total / page.limit),
  )

  return { data, pagination: page }
}

/**
 * Assevera um erro por STATUS e por CODE.
 *
 * Nunca por `message`: o texto muda com revisao de copy e com traducao, e um teste que
 * quebra porque alguem melhorou uma frase treina o time a ignorar a suite (ADR-023).
 */
export function expectError(
  res: ApiResponse<unknown>,
  status: number,
  code: ErrorCode,
): ErrorEnvelope {
  expect(res.body, `resposta sem corpo JSON. ${describe(res)}`).not.toBeNull()
  expect(res.status, `status inesperado. ${describe(res)}`).toBe(status)
  expect(res.body?.success, `envelope de erro com success=true. ${describe(res)}`).toBe(false)

  const body = res.body as ErrorEnvelope

  expect(body.code, `code divergente. ${describe(res)}`).toBe(code)
  expect(body.message, `erro sem message. ${describe(res)}`).toEqual(expect.any(String))

  return body
}

/**
 * Assevera QUAIS campos falharam na validacao, pelo caminho pontilhado.
 *
 * E o que separa "a requisicao foi recusada" de "a requisicao foi recusada PELO motivo
 * certo". Um DTO que passasse a exigir um campo a mais continuaria devolvendo 422, e sem
 * esta verificacao o teste seguiria verde contra um contrato diferente.
 */
export function expectFieldErrors(res: ApiResponse<unknown>, ...fields: string[]): ErrorEnvelope {
  const body = expectError(res, 422, 'VALIDATION_ERROR')

  const reported = (body.errors ?? []).map((error) => error.field)

  for (const field of fields) {
    expect(
      reported,
      `esperava erro no campo "${field}". Recebidos: [${reported.join(', ')}]`,
    ).toContain(field)
  }

  return body
}

/**
 * Assevera que a resposta respondeu dentro de um limite.
 *
 * Deliberadamente generoso e usado com parcimonia. Um teste funcional que assevera
 * milissegundos vira intermitente na primeira execucao do CI sob carga — e teste
 * intermitente custa mais confianca do que compra desempenho. Serve para pegar a regressao
 * grosseira (a consulta que virou N+1), nao para medir performance.
 */
export function expectFasterThan(res: ApiResponse<unknown>, maxMs: number): void {
  expect(res.durationMs, `resposta levou ${res.durationMs}ms. ${describe(res)}`).toBeLessThan(maxMs)
}

/** Assevera que a API ecoou o `x-request-id` enviado — a base da correlacao com o log. */
export function expectRequestIdEcho(res: ApiResponse<unknown>): void {
  expect(res.requestId, 'a API deveria ecoar o x-request-id recebido').not.toBeNull()
}
