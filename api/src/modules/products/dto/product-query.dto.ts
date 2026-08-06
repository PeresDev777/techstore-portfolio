import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'
import { trim } from '../../../common/transforms/string.transforms'

/**
 * Ordenacoes suportadas. Os valores espelham `PRODUCT_SORT` do frontend, que a suite de
 * automacao ja usa como massa (`automation/data/products.ts` -> `SORT`).
 */
export const PRODUCT_SORT = {
  relevance: 'relevance',
  priceAsc: 'price-asc',
  priceDesc: 'price-desc',
  ratingDesc: 'rating-desc',
  nameAsc: 'name-asc',
} as const

export type ProductSort = (typeof PRODUCT_SORT)[keyof typeof PRODUCT_SORT]

export const PRODUCT_SORT_VALUES = Object.values(PRODUCT_SORT)

export class ProductQueryDto extends PaginationQueryDto {
  /** Busca textual. Todos os termos precisam aparecer, em qualquer ordem, sem acento. */
  @ApiPropertyOptional({ example: 'fone aurora' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  // Teto generoso, mas existente: sem limite, uma busca de 1 MB vira uma consulta de 1 MB.
  @MaxLength(120)
  search?: string

  /** Nome de exibição ("Áudio") ou slug ("audio") — a API aceita os dois. */
  @ApiPropertyOptional({ example: 'audio' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  category?: string

  @ApiPropertyOptional({ example: true, description: 'Apenas produtos com estoque.' })
  @IsOptional()
  /*
   * Query string nao tem tipo: `?inStock=true` chega como a STRING "true". Sem esta
   * conversao, `@IsBoolean` reprovaria sempre — e com `enableImplicitConversion` sozinho,
   * qualquer texto viraria `true` (inclusive "false"), que e o pior dos dois mundos.
   */
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return value as unknown
  })
  @IsBoolean({ message: 'inStock deve ser true ou false.' })
  inStock?: boolean

  @ApiPropertyOptional({ enum: PRODUCT_SORT_VALUES, default: PRODUCT_SORT.relevance })
  @IsOptional()
  /*
   * Valor invalido responde 422, e nao "cai no padrao em silencio".
   *
   * O frontend faz o oposto de proposito (ADR-007: `?ordenar=lixo` usa o padrao para nao
   * quebrar a tela), e os dois comportamentos estao certos para as suas camadas: a UI
   * protege o usuario de uma URL adulterada; a API informa o cliente de que ele mandou
   * algo que nao existe. Como o frontend sanitiza antes de chamar, a API so recebe valores
   * validos vindos dele — e o teste E2E de ordenacao invalida continua verde.
   */
  @IsIn(PRODUCT_SORT_VALUES, { message: 'Ordenação inválida.' })
  sort?: ProductSort
}
