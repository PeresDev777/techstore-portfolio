import { API_ERROR_CODE, ApiError, type ApiErrorCode } from '@/services/apiError'
import type { AuthSession } from '@/types/user'
import { readJson, remove, writeJson } from '@/utils/storage'

/**
 * Camada de transporte — agora contra a API real.
 *
 * Este arquivo era a simulação de rede: latência artificial sobre dados em memória. O
 * ADR-002 previu exatamente esta troca — "quando um backend real entrar, este arquivo é
 * substituído por `fetch` e os serviços permanecem intactos". A fronteira se pagou:
 * nenhum componente sabe que a origem dos dados mudou.
 */

export const SESSION_STORAGE_KEY = 'techstore:session'

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1'

/**
 * Envelope da API. TODA resposta vem nesta forma, inclusive as de erro.
 * Ver `docs/api-architecture.md` (ADR-022 e ADR-023).
 */
interface SuccessEnvelope<T> {
  success: true
  message: string
  data: T
  pagination?: { page: number; limit: number; total: number; totalPages: number }
}

interface ErrorEnvelope {
  success: false
  message: string
  code: string
  errors: { field: string; message: string }[]
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  /** Rotas de autenticação não tentam renovar a sessão — evitaria um laço. */
  skipAuthRetry?: boolean
}

// --- sessão -----------------------------------------------------------------

export function readSession(): AuthSession | null {
  return readJson<AuthSession>(SESSION_STORAGE_KEY)
}

export function writeSession(session: AuthSession): void {
  writeJson(SESSION_STORAGE_KEY, session)
}

export function clearSession(): void {
  remove(SESSION_STORAGE_KEY)
}

// --- erros ------------------------------------------------------------------

/**
 * Traduz o `code` da API para o código conhecido pela aplicação.
 *
 * O frontend já decidia comportamento por código desde o mock, e os códigos da API foram
 * desenhados como um SUPERCONJUNTO dos que ele conhecia — por isso esta função é quase
 * uma identidade. Um código desconhecido cai em `UNKNOWN` em vez de quebrar: um cliente
 * que estoura ao receber um código novo condena a API a nunca mais crescer.
 */
function toApiErrorCode(code: string): ApiErrorCode {
  const known = Object.values(API_ERROR_CODE) as string[]
  return known.includes(code) ? (code as ApiErrorCode) : API_ERROR_CODE.UNKNOWN
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_URL}${path}`)

  for (const [key, value] of Object.entries(query ?? {})) {
    // Ausente não vira `?param=undefined`: simplesmente não é enviado.
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

// --- renovação de sessão ----------------------------------------------------

/**
 * Renovação em voo, compartilhada por todas as chamadas.
 *
 * Sem isto, três requisições que recebem 401 ao mesmo tempo dispararIam três renovações
 * com o MESMO refresh token. As duas últimas apresentariam um token já rotacionado — que
 * a API interpreta, corretamente, como roubo, e revoga a família inteira (ADR-025).
 * O resultado seria um usuário legítimo deslogado por excesso de zelo do próprio cliente.
 */
let refreshInFlight: Promise<string | null> | null = null

async function requestNewAccessToken(): Promise<string | null> {
  const session = readSession()

  if (!session?.refreshToken) return null

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  }).catch(() => null)

  if (!response?.ok) {
    clearSession()
    return null
  }

  const envelope = (await response.json()) as SuccessEnvelope<{
    accessToken: string
    refreshToken: string
  }>

  writeSession({
    user: session.user,
    accessToken: envelope.data.accessToken,
    refreshToken: envelope.data.refreshToken,
  })

  return envelope.data.accessToken
}

function refreshOnce(): Promise<string | null> {
  refreshInFlight ??= requestNewAccessToken().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

// --- requisição -------------------------------------------------------------

function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

interface Result<T> {
  data: T
  total: number
}

async function execute<T>(path: string, options: RequestOptions): Promise<Result<T>> {
  let response: Response | null = await send(
    path,
    options,
    readSession()?.accessToken ?? null,
  ).catch(() => null)

  /*
   * 401 dispara UMA tentativa de renovação e repete a requisição original.
   *
   * É o que torna o access token de 15 minutos invisível para o usuário: a sessão dura os
   * 7 dias do refresh e a renovação acontece sem que ninguém perceba.
   */
  if (response?.status === 401 && !options.skipAuthRetry) {
    const renewed = await refreshOnce()

    if (renewed) {
      response = await send(path, options, renewed).catch(() => null)
    }
  }

  if (!response) {
    // Falha de rede não produz resposta HTTP — não há envelope para ler.
    throw new ApiError(API_ERROR_CODE.NETWORK, 'Não foi possível conectar ao servidor.')
  }

  const payload = (await response.json().catch(() => null)) as
    SuccessEnvelope<T> | ErrorEnvelope | null

  if (!payload) {
    throw new ApiError(API_ERROR_CODE.NETWORK, 'Resposta inválida do servidor.')
  }

  if (!payload.success) {
    throw new ApiError(toApiErrorCode(payload.code), payload.message, payload.errors)
  }

  return { data: payload.data, total: payload.pagination?.total ?? 0 }
}

/**
 * Executa a requisição e devolve apenas `data`.
 *
 * Serviços e componentes nunca veem `success` nem `message`: o custo do envelope — um
 * nível de aninhamento — é pago aqui, uma vez só.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await execute<T>(path, options)
  return result.data
}

/** Variante para listagens que também precisam do total da paginação. */
export function requestList<T>(path: string, options: RequestOptions = {}): Promise<Result<T[]>> {
  return execute<T[]>(path, options)
}
