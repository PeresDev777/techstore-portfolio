import { ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'
import { CreateProductDto } from './create-product.dto'

export class UpdateProductDto extends PartialType(CreateProductDto) {
  /**
   * Recoloca (ou retira) o produto de catalogo.
   *
   * Existe so aqui, e nao no DTO de criacao: produto nasce ativo, e oferecer
   * `isActive: false` na criacao permitiria cadastrar algo ja invisivel — um estado sem
   * proposito que so gera duvida depois.
   *
   * Sem este campo, `DELETE` seria irreversivel pela API: a rota desativa o produto e nao
   * havia nenhuma forma de reverter. Lacuna encontrada ao testar o carrinho na Sprint 5.
   */
  @ApiPropertyOptional({ example: true, description: 'Recoloca o produto em catálogo.' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return value as unknown
  })
  @IsBoolean({ message: 'isActive deve ser true ou false.' })
  isActive?: boolean
}
