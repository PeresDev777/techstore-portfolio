import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import type { PaginatedResult } from '../../common/dto/paginated-result'
import {
  ApiErrorResponse,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '../../common/swagger/api-envelope.decorators'
import type { AuthenticatedUser } from '../../common/types/authenticated-user'
import { CreateOrderDto } from './dto/create-order.dto'
import { OrderQueryDto } from './dto/order-query.dto'
import { OrderEntity, OrderSummaryEntity } from './entities/order.entity'
import { OrdersService } from './orders.service'

/**
 * Como no carrinho, o usuario vem do TOKEN — nunca da URL.
 *
 * Numeros de pedido sao curtos e legiveis (`TS-4F2A9C`), logo enumeraveis. Se a
 * autorizacao dependesse de comparar um id do caminho com o dono, bastaria esquecer a
 * comparacao em uma rota para expor o historico de compras de todo mundo.
 */
@ApiTags('Pedidos')
@ApiBearerAuth('access-token')
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Fecha o pedido a partir do carrinho.',
    description:
      'Os itens vêm do carrinho no servidor — o corpo traz apenas comprador e endereço. ' +
      'Estoque e preço são lidos do banco dentro da transação.',
  })
  @ApiSuccessResponse(OrderEntity, { status: 201 })
  @ApiErrorResponse(409, 'Carrinho vazio ou estoque insuficiente.', ERROR_CODE.INSUFFICIENT_STOCK)
  @ApiErrorResponse(
    422,
    'Dados do comprador ou do endereço inválidos.',
    ERROR_CODE.VALIDATION_ERROR,
  )
  @ResponseMessage('Pedido criado com sucesso.')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderEntity> {
    return this.orders.create(user.id, dto)
  }

  @Get()
  @ApiOperation({ summary: 'Histórico de pedidos do usuário, do mais recente ao mais antigo.' })
  @ApiPaginatedResponse(OrderSummaryEntity)
  @ResponseMessage('Pedidos listados com sucesso.')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderQueryDto,
  ): Promise<PaginatedResult<OrderSummaryEntity>> {
    return this.orders.findAll(user.id, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um pedido do usuário autenticado.' })
  @ApiParam({ name: 'id', example: 'TS-4F2A9C' })
  @ApiSuccessResponse(OrderEntity)
  @ApiErrorResponse(404, 'Pedido inexistente OU de outro usuário.', ERROR_CODE.NOT_FOUND)
  @ResponseMessage('Pedido recuperado com sucesso.')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<OrderEntity> {
    return this.orders.findById(user.id, id)
  }

  @Post(':id/cancel')
  // 200 e nao 201: cancelar nao cria recurso nenhum. O padrao do Nest para POST e 201.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancela um pedido pendente e devolve o estoque.',
    description: 'Apenas pedidos em PENDING. Pedido pago exige estorno, não cancelamento.',
  })
  @ApiSuccessResponse(OrderEntity)
  @ApiErrorResponse(409, 'Pedido já cancelado ou já pago.', ERROR_CODE.CONFLICT)
  @ResponseMessage('Pedido cancelado com sucesso.')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<OrderEntity> {
    return this.orders.cancel(user.id, id)
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirma o pagamento (SIMULADO).',
    description:
      'Não há gateway de pagamento neste projeto. O endpoint existe para tornar o estado ' +
      'PAID alcançável e completar o ciclo de vida do pedido.',
  })
  @ApiSuccessResponse(OrderEntity)
  @ApiErrorResponse(409, 'Pedido já pago ou cancelado.', ERROR_CODE.CONFLICT)
  @ResponseMessage('Pagamento confirmado com sucesso.')
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<OrderEntity> {
    return this.orders.pay(user.id, id)
  }
}
