import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import { ApiErrorResponse, ApiSuccessResponse } from '../../common/swagger/api-envelope.decorators'
import type { AuthenticatedUser } from '../../common/types/authenticated-user'
import { CartService } from './cart.service'
import { AddCartItemDto } from './dto/add-cart-item.dto'
import { UpdateCartItemDto } from './dto/update-cart-item.dto'
import { CartEntity } from './entities/cart.entity'

/**
 * O carrinho e sempre o DO USUARIO AUTENTICADO.
 *
 * Nenhuma rota aqui recebe um id de carrinho ou de usuario: ele vem do token, sempre. Se
 * existisse `GET /carts/:id`, cada handler precisaria comparar o dono com quem pediu — e
 * esquecer essa comparacao uma vez significa expor o carrinho de qualquer pessoa (IDOR).
 * Sem o parametro, a falha e estruturalmente impossivel.
 *
 * E o que garante o isolamento entre contas que a suite ja assevera no frontend (ADR-012),
 * agora no servidor: dois usuarios no mesmo navegador nao compartilham carrinho porque a
 * chave e a sessao, nao o dispositivo.
 */
@ApiTags('Carrinho')
@ApiBearerAuth('access-token')
@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Carrinho do usuário autenticado, com totais calculados.' })
  @ApiSuccessResponse(CartEntity)
  @ApiErrorResponse(401, 'Autenticação necessária.', ERROR_CODE.UNAUTHENTICATED)
  @ResponseMessage('Carrinho recuperado com sucesso.')
  find(@CurrentUser() user: AuthenticatedUser): Promise<CartEntity> {
    return this.cart.findByUser(user.id)
  }

  @Post('items')
  @ApiOperation({
    summary: 'Adiciona um produto ao carrinho.',
    description:
      'Produto já presente SOMA à quantidade existente em vez de criar uma segunda linha. ' +
      'O limite de estoque é aplicado sobre a soma resultante.',
  })
  @ApiSuccessResponse(CartEntity, { status: 201 })
  @ApiErrorResponse(404, 'Produto não encontrado ou fora de catálogo.', ERROR_CODE.NOT_FOUND)
  @ApiErrorResponse(409, 'Estoque insuficiente.', ERROR_CODE.INSUFFICIENT_STOCK)
  @ResponseMessage('Produto adicionado ao carrinho com sucesso.')
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartEntity> {
    return this.cart.addItem(user.id, dto)
  }

  @Patch('items/:productId')
  @ApiOperation({
    summary: 'Define a quantidade de um item.',
    description: 'A quantidade é ABSOLUTA, não incremental. Para remover, use DELETE.',
  })
  @ApiParam({ name: 'productId', description: 'Id ou slug do produto.' })
  @ApiSuccessResponse(CartEntity)
  @ApiErrorResponse(404, 'Item não está no carrinho.', ERROR_CODE.NOT_FOUND)
  @ApiErrorResponse(409, 'Estoque insuficiente.', ERROR_CODE.INSUFFICIENT_STOCK)
  @ResponseMessage('Quantidade atualizada com sucesso.')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    return this.cart.updateItem(user.id, productId, dto)
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove um item do carrinho.' })
  @ApiParam({ name: 'productId', description: 'Id ou slug do produto.' })
  @ApiSuccessResponse(CartEntity)
  @ApiErrorResponse(404, 'Item não está no carrinho.', ERROR_CODE.NOT_FOUND)
  @ResponseMessage('Produto removido do carrinho com sucesso.')
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ): Promise<CartEntity> {
    return this.cart.removeItem(user.id, productId)
  }

  @Delete()
  @ApiOperation({ summary: 'Esvazia o carrinho.' })
  @ApiSuccessResponse(CartEntity)
  @ResponseMessage('Carrinho esvaziado com sucesso.')
  clear(@CurrentUser() user: AuthenticatedUser): Promise<CartEntity> {
    return this.cart.clear(user.id)
  }
}
