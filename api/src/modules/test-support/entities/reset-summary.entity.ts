import { ApiProperty } from '@nestjs/swagger'

/**
 * Resumo do que o reset recriou.
 *
 * Devolver os numeros — e nao apenas 200 — permite que a suite assevere que a massa esta
 * completa antes de comecar o cenario. Um reset que "funcionou" mas semeou pela metade
 * produziria falhas confusas mais adiante, longe da causa.
 */
export class ResetSummaryEntity {
  @ApiProperty({ example: 6 })
  categories: number

  @ApiProperty({ example: 4 })
  users: number

  @ApiProperty({ example: 12 })
  products: number
}
