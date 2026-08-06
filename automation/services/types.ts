/**
 * O contrato de resposta da API, em TypeScript.
 *
 * Toda resposta passa pelo `ResponseInterceptor` e pelo `AllExceptionsFilter` da API
 * (ADR-022 e ADR-023), entao a suite inteira so precisa conhecer DUAS formas. E o que
 * torna possivel um unico helper de assercao servir todos os testes.
 */

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface SuccessEnvelope<T> {
  success: true
  message: string
  data: T
  /** Presente apenas em listagens paginadas. */
  pagination?: Pagination
}

/**
 * Erro de campo com caminho pontilhado (`customer.cpf`, `address.zipCode`).
 *
 * O padrao do Nest devolveria `["email must be an email"]`, obrigando o teste a adivinhar
 * por substring a qual campo cada frase pertence (ADR-024).
 */
export interface FieldError {
  field: string
  message: string
}

export interface ErrorEnvelope {
  success: false
  message: string
  code: string
  errors?: FieldError[]
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope

/**
 * Codigos de erro da API.
 *
 * Asseverar por `code` e nao por `message` e o que torna o teste imune a revisao de copy e
 * a traducao (ADR-023). Uma frase melhorada nao pode reprovar a suite.
 */
export const ERROR_CODE = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

/**
 * Resposta crua de uma chamada, antes de qualquer assercao.
 *
 * Os services devolvem ISTO — nunca `data` desembrulhado. Um service que devolvesse so o
 * dado obrigaria cada teste de erro a ter um caminho proprio, e testar 401, 403, 404, 409 e
 * 422 e metade do trabalho de uma suite de API.
 */
export interface ApiResponse<T> {
  status: number
  ok: boolean
  headers: Record<string, string>
  /** Ecoado pela API (ADR-031): liga um teste vermelho ao log daquela requisicao. */
  requestId: string | null
  body: Envelope<T> | null
  durationMs: number
}

// --- entidades, na forma em que a API as devolve ----------------------------

export interface UserPayload {
  id: string
  name: string
  email: string
  role: 'CUSTOMER' | 'ADMIN'
  createdAt?: string
}

export interface SessionPayload {
  user: UserPayload
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export interface ProductPayload {
  id: string
  slug: string
  name: string
  brand: string
  description: string
  priceInCents: number
  category: string | { id: string; name: string; slug: string }
  rating: number
  reviewCount: number
  stock: number
  isActive?: boolean
}

export interface CartItemPayload {
  productId: string
  name: string
  slug: string
  unitPriceInCents: number
  quantity: number
  lineTotalInCents: number
  unavailable?: boolean
  unavailableReason?: string
}

export interface CartPayload {
  items: CartItemPayload[]
  subtotalInCents: number
  shippingInCents: number
  totalInCents: number
}

export interface OrderItemPayload {
  productId: string
  name: string
  slug: string
  unitPriceInCents: number
  quantity: number
  lineTotalInCents: number
}

export interface OrderPayload {
  id: string
  number: string
  status: 'PENDING' | 'PAID' | 'CANCELED'
  items: OrderItemPayload[]
  subtotalInCents: number
  shippingInCents: number
  totalInCents: number
  createdAt: string
}
