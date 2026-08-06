import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

export class UpdateCartItemDto {
  /**
   * Minimo 1, e nao 0.
   *
   * O redutor do frontend trata quantidade zero como remocao (`cartReducer.ts`), e faz
   * sentido la: o `QuantityStepper` decrementa ate zero e o item some, em um gesto so.
   *
   * Na API existe `DELETE /cart/items/:productId` para isso. Aceitar 0 aqui criaria dois
   * caminhos para a mesma operacao e um verbo mentiroso — um PATCH que apaga o recurso que
   * deveria atualizar. O cliente que decrementa ate zero chama o DELETE; a UI nao muda.
   */
  @ApiProperty({ example: 2, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade mínima é 1. Para remover o item, use DELETE.' })
  @Max(100, { message: 'A quantidade máxima por item é 100.' })
  quantity: number
}
