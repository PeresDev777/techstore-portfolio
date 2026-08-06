import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsInt, IsString, Max, Min } from 'class-validator'
import { trim } from '../../../common/transforms/string.transforms'

export class AddCartItemDto {
  @ApiProperty({ example: 'prd-001', description: 'Id ou slug do produto.' })
  @IsString({ message: 'Informe o produto.' })
  @Transform(trim)
  productId: string

  /**
   * Teto de 100 por requisicao — nao e o limite de estoque, que e verificado depois
   * contra o produto real. E uma barreira de sanidade: `quantity: 999999999` seria aceito
   * pela validacao, rejeitado pelo estoque, e teria custado uma consulta ao banco para
   * descobrir o obvio.
   */
  @ApiProperty({ example: 1, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade mínima é 1.' })
  @Max(100, { message: 'A quantidade máxima por operação é 100.' })
  quantity: number
}
