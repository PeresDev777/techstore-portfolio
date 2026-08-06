import { ApiPropertyOptional } from '@nestjs/swagger'
import { OrderStatus } from '@prisma/client'
import { IsEnum, IsOptional } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'

export class OrderQueryDto extends PaginationQueryDto {
  /** Filtra o historico por situacao. Ausente devolve todos. */
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Situação de pedido inválida.' })
  status?: OrderStatus
}
