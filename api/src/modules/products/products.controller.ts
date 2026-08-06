import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { Public } from '../../common/decorators/public.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { PaginatedResult } from '../../common/dto/paginated-result'
import {
  ApiErrorResponse,
  ApiListResponse,
  ApiNoDataResponse,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '../../common/swagger/api-envelope.decorators'
import { CreateProductDto } from './dto/create-product.dto'
import { ProductQueryDto } from './dto/product-query.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProductEntity } from './entities/product.entity'
import { ProductsService } from './products.service'

@ApiTags('Produtos')
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lista o catálogo com busca, filtros, ordenação e paginação.',
    description:
      'A busca ignora acentos e exige que TODOS os termos apareçam, em qualquer ordem: ' +
      '`?search=vertex notebook` e `?search=notebook vertex` devolvem o mesmo resultado.',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Nome ("Áudio") ou slug ("audio").' })
  @ApiPaginatedResponse(ProductEntity)
  @ApiErrorResponse(422, 'Parâmetro de consulta inválido.', ERROR_CODE.VALIDATION_ERROR)
  @ResponseMessage('Produtos listados com sucesso.')
  findAll(@Query() query: ProductQueryDto): Promise<PaginatedResult<ProductEntity>> {
    return this.products.findAll(query)
  }

  /*
   * `/:identifier/related` e declarada ANTES de `/:identifier` por seguranca de ordem —
   * embora aqui os caminhos tenham profundidades diferentes e nao colidam, manter rotas
   * mais especificas primeiro evita a armadilha no dia em que alguem adicionar `/:a/:b`.
   */
  @Public()
  @Get(':identifier/related')
  @ApiOperation({ summary: 'Produtos relacionados (mesma categoria).' })
  @ApiListResponse(ProductEntity)
  @ResponseMessage('Produtos relacionados listados com sucesso.')
  findRelated(@Param('identifier') identifier: string): Promise<ProductEntity[]> {
    return this.products.findRelated(identifier)
  }

  @Public()
  @Get(':identifier')
  @ApiOperation({ summary: 'Busca um produto por id ou slug.' })
  @ApiSuccessResponse(ProductEntity)
  @ApiErrorResponse(404, 'Produto não encontrado ou fora de catálogo.', ERROR_CODE.NOT_FOUND)
  @ResponseMessage('Produto recuperado com sucesso.')
  findOne(@Param('identifier') identifier: string): Promise<ProductEntity> {
    return this.products.findByIdOrSlug(identifier)
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Post()
  @ApiOperation({ summary: 'Cria um produto (administrador).' })
  @ApiSuccessResponse(ProductEntity, { status: 201 })
  @ApiErrorResponse(403, 'Sem permissão.', ERROR_CODE.FORBIDDEN)
  @ApiErrorResponse(409, 'Slug em uso ou categoria inexistente.', ERROR_CODE.CONFLICT)
  @ResponseMessage('Produto criado com sucesso.')
  create(@Body() dto: CreateProductDto): Promise<ProductEntity> {
    return this.products.create(dto)
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto (administrador).' })
  @ApiSuccessResponse(ProductEntity)
  @ResponseMessage('Produto atualizado com sucesso.')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto): Promise<ProductEntity> {
    return this.products.update(id, dto)
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Delete(':id')
  @ApiOperation({
    summary: 'Retira um produto de catálogo (administrador).',
    description:
      'Exclusão lógica: o produto sai das listagens e passa a responder 404, mas continua ' +
      'referenciado por pedidos históricos.',
  })
  @ApiNoDataResponse('Produto retirado de catálogo.')
  @ResponseMessage('Produto removido do catálogo com sucesso.')
  remove(@Param('id') id: string): Promise<null> {
    return this.products.remove(id)
  }
}
