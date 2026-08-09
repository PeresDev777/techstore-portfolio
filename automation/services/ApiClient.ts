import { randomUUID } from 'node:crypto'

import type { APIRequestContext, APIResponse } from '@playwright/test'

import type { ApiResponse, Envelope } from '@services/types'
import { ENV } from '@utils/env'

/** Uma chamada registrada, para virar evidencia quando o teste falha. */
export interface LoggedCall {
  method: string
  url: string
  status: number
  requestId: string | null
  durationMs: number
  requestBody?: unknown
  responseBody?: unknown
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}

/**
 * Cliente HTTP da suite de API.
 *
 * Nao e um wrapper por wrapper. Ele existe para tres coisas que um `request.post` solto no
 * spec nao faz:
 *
 * 1. **Desembrulha o envelope uma vez so.** Toda resposta da API tem a mesma forma
 *    (ADR-022); ler `await res.json()` em cada teste espalharia a mesma linha por toda a
 *    suite.
 *
 * 2. **Gera e propaga o `x-request-id`.** A API reaproveita o id enviado pelo cliente e o
 *    devolve no header (ADR-031). Gerando aqui, um teste vermelho no CI carrega um id que
 *    encontra a linha exata do log da API com um grep — em vez de "aconteceu alguma coisa
 *    em algum momento".
 *
 * 3. **Registra cada chamada.** Screenshot e video nao existem sem navegador: a moeda de
 *    evidencia de um teste de API e o par requisicao/resposta. O `apiClient` anexa o
 *    registro ao relatorio quando o teste falha (ver `fixtures/api.ts`).
 *
 * O token e IMUTAVEL: `withToken` devolve um cliente novo em vez de mudar este. Um cliente
 * mutavel produziria o pior tipo de teste de autorizacao — aquele em que a ordem das
 * chamadas decide quem esta autenticado, e trocar duas linhas muda o resultado sem que o
 * codigo pareca diferente.
 */
export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string | null = null,
    /** Compartilhado entre os clientes derivados: a evidencia e do TESTE, nao do cliente. */
    readonly calls: LoggedCall[] = [],
    /**
     * Raiz das rotas de negocio.
     *
     * A URL e montada AQUI e nao delegada ao `baseURL` do Playwright, e isso custou uma
     * execucao vermelha para ficar claro: o `baseURL` e resolvido com a semantica de
     * `new URL(path, base)`, entao `/products` sobre `http://host/api/v1` descarta o
     * prefixo e vira `http://host/products` — 404 sem nenhuma pista do motivo.
     *
     * Fazer os paths relativos (`products`) resolveria por acidente e quebraria de novo no
     * primeiro path com barra. Concatenar explicitamente e a unica forma que nao depende de
     * uma regra que ninguem lembra na hora de ler o erro.
     */
    private readonly baseUrl: string = ENV.apiUrl,
  ) {}

  /** Cliente equivalente, autenticado com outro token. */
  withToken(token: string | null): ApiClient {
    return new ApiClient(this.request, token, this.calls, this.baseUrl)
  }

  /** Cliente sem credencial — para provar que uma rota exige autenticacao. */
  anonymous(): ApiClient {
    return this.withToken(null)
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>('GET', path, undefined, options)
  }

  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>('POST', path, body, options)
  }

  patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>('PATCH', path, body, options)
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>('DELETE', path, undefined, options)
  }

  private async send<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const requestId = `e2e-${randomUUID()}`
    const startedAt = Date.now()

    const response: APIResponse = await this.request.fetch(`${this.baseUrl}${path}`, {
      method,
      params: cleanQuery(options.query),
      headers: {
        'x-request-id': requestId,
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
      ...(body === undefined ? {} : { data: body }),
      /* A suite assevera 4xx e 5xx: um status de erro nao pode virar excecao de transporte. */
      failOnStatusCode: false,
    })

    const durationMs = Date.now() - startedAt
    const headers = response.headers()

    /*
     * `json()` estoura em corpo vazio ou em HTML. Um 5xx nao tratado costuma devolver
     * exatamente isso — e o teste precisa reportar "a API devolveu algo que nao e o
     * envelope", nao morrer num erro de parse sem contexto.
     */
    const parsed = (await response.json().catch(() => null)) as Envelope<T> | null

    this.calls.push({
      method,
      url: response.url(),
      status: response.status(),
      requestId: headers['x-request-id'] ?? null,
      durationMs,
      requestBody: body,
      responseBody: parsed,
    })

    return {
      status: response.status(),
      ok: response.ok(),
      headers,
      requestId: headers['x-request-id'] ?? null,
      body: parsed,
      durationMs,
    }
  }
}

/**
 * Remove chaves `undefined` da query.
 *
 * Sem isto, `{ page: undefined }` viraria `?page=undefined` — a API receberia a string
 * literal e responderia 422, e o teste acusaria um defeito de validacao que nao existe.
 */
function cleanQuery(
  query: RequestOptions['query'],
): Record<string, string | number | boolean> | undefined {
  if (!query) return undefined

  const entries = Object.entries(query).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
