import { ApiProperty } from '@nestjs/swagger'

export class PaginationMeta {
  @ApiProperty({ example: 1, description: 'Pagina atual, base 1.' })
  page: number

  @ApiProperty({ example: 10, description: 'Itens por pagina.' })
  limit: number

  @ApiProperty({ example: 50, description: 'Total de registros que satisfazem o filtro.' })
  total: number

  @ApiProperty({ example: 5, description: 'Total de paginas.' })
  totalPages: number
}

/**
 * Resultado paginado devolvido pelos services.
 *
 * Existe como CLASSE, e nao como objeto literal `{ data, pagination }`, por um motivo
 * pratico: o interceptor de resposta precisa distinguir "isto e uma lista paginada" de
 * "isto e um recurso que por acaso tem um campo chamado data". `instanceof` responde
 * isso sem ambiguidade; inspecionar chaves seria adivinhacao.
 */
export class PaginatedResult<T> {
  readonly data: T[]
  readonly pagination: PaginationMeta

  private constructor(data: T[], pagination: PaginationMeta) {
    this.data = data
    this.pagination = pagination
  }

  static create<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
    return new PaginatedResult(data, {
      page,
      limit,
      total,
      // `Math.ceil(0 / 10)` da 0 — e uma busca sem resultado tem zero paginas, nao uma.
      totalPages: Math.ceil(total / limit),
    })
  }
}
