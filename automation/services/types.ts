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

/*
 * As entidades abaixo espelham `components.schemas` de `/api/docs-json`.
 *
 * **Escritas a mao aqui, e isso e divida consciente.** A primeira versao deste arquivo foi
 * deduzida dos DTOs de ENTRADA e errou quase todo campo de SAIDA: o preco do produto sai
 * como `price` e nao `priceInCents`, os totais vem aninhados em `totals`, e o `id` do
 * pedido JA E o numero `TS-XXXXXX` — nao existe campo `number`. Tres testes falharam com
 * 422 e 500 antes de a divergencia aparecer.
 *
 * E a demonstracao pratica do que a Sprint 4 resolve: um tipo escrito a mao e uma SEGUNDA
 * fonte de verdade, e ela diverge da primeira no dia em que e escrita. Estes tipos servem
 * a ergonomia do TypeScript; quem assevera a FORMA da resposta e o teste de contrato,
 * validando contra a spec publicada.
 *
 * Repare que entrada e saida usam nomes diferentes de proposito na API: `priceInCents` no
 * DTO deixa a unidade explicita para quem escreve; `price` na entidade e o nome do dominio.
 */
export interface ProductPayload {
  id: string
  slug: string
  name: string
  brand: string
  description: string
  /** Em CENTAVOS, apesar do nome curto (ADR-008). */
  price: number
  category: string
  categorySlug: string
  rating: number
  reviewCount: number
  imageUrl: string
  stock: number
}

export interface CartItemPayload {
  id: string
  product: ProductPayload
  quantity: number
  lineTotal: number
  unavailable?: boolean
  unavailableReason?: string | null
}

export interface CartTotals {
  itemCount: number
  lineCount: number
  subtotal: number
  shipping: number
  total: number
}

/** Totais CALCULADOS, nunca persistidos — o oposto do pedido (ADR-026). */
export interface CartPayload {
  items: CartItemPayload[]
  totals: CartTotals
}

export interface OrderItemPayload {
  id: string
  productId: string
  productName: string
  productSlug: string
  /** Congelado no fechamento. Reajuste no catalogo nao o altera. */
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface OrderTotals {
  subtotal: number
  shipping: number
  total: number
}

export interface OrderPayload {
  /** O proprio numero do pedido: `TS-4F2A9C`. Nao existe campo `number` separado. */
  id: string
  status: 'PENDING' | 'PAID' | 'CANCELED'
  placedAt: string
  canceledAt: string | null
  itemCount: number
  /** Totais PERSISTIDOS: um pedido registra o que foi cobrado, nao o que custaria hoje. */
  totals: OrderTotals
  customer: { fullName: string; email: string; cpf: string; phone: string }
  address: Record<string, string | null>
  items: OrderItemPayload[]
}
