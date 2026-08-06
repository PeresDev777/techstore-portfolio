import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

/**
 * Parametros de paginacao compartilhados por toda listagem.
 *
 * Herdado pelos DTOs de query de cada modulo (`class ProductQueryDto extends
 * PaginationQueryDto`), o que garante que `page` e `limit` se comportem igual em
 * `/products`, `/orders` e em qualquer listagem futura. Paginacao inconsistente entre
 * endpoints e um dos atritos mais citados por quem consome API dos outros.
 */
export class PaginationQueryDto {
  /** Pagina desejada, base 1. */
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser maior ou igual a 1.' })
  page: number = 1

  /**
   * Itens por pagina.
   *
   * O teto de 100 nao e detalhe: sem ele, `?limit=1000000` e um vetor de negacao de
   * servico gratuito — um unico cliente derruba o banco pedindo a tabela inteira.
   */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser maior ou igual a 1.' })
  @Max(100, { message: 'O limite máximo por página é 100.' })
  limit: number = 10

  /** Deslocamento correspondente, para o `skip` do Prisma. */
  get skip(): number {
    return (this.page - 1) * this.limit
  }
}
