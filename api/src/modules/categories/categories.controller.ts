import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { Public } from '../../common/decorators/public.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import {
  ApiErrorResponse,
  ApiListResponse,
  ApiNoDataResponse,
  ApiSuccessResponse,
} from '../../common/swagger/api-envelope.decorators'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'
import { CategoryEntity } from './entities/category.entity'

@ApiTags('Categorias')
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista as categorias com a contagem de produtos ativos.' })
  @ApiListResponse(CategoryEntity)
  @ResponseMessage('Categorias listadas com sucesso.')
  findAll(): Promise<CategoryEntity[]> {
    return this.categories.findAll()
  }

  @Public()
  @Get(':identifier')
  @ApiOperation({ summary: 'Busca uma categoria por id ou slug.' })
  @ApiSuccessResponse(CategoryEntity)
  @ApiErrorResponse(404, 'Categoria não encontrada.', ERROR_CODE.NOT_FOUND)
  @ResponseMessage('Categoria recuperada com sucesso.')
  findOne(@Param('identifier') identifier: string): Promise<CategoryEntity> {
    return this.categories.findByIdOrSlug(identifier)
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Post()
  @ApiOperation({ summary: 'Cria uma categoria (administrador).' })
  @ApiSuccessResponse(CategoryEntity, { status: 201 })
  @ApiErrorResponse(409, 'Nome ou slug já em uso.', ERROR_CODE.CONFLICT)
  @ResponseMessage('Categoria criada com sucesso.')
  create(@Body() dto: CreateCategoryDto): Promise<CategoryEntity> {
    return this.categories.create(dto)
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma categoria (administrador).' })
  @ApiSuccessResponse(CategoryEntity)
  @ResponseMessage('Categoria atualizada com sucesso.')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryEntity> {
    return this.categories.update(id, dto)
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma categoria vazia (administrador).' })
  @ApiNoDataResponse('Categoria removida.')
  @ApiErrorResponse(409, 'Categoria em uso por produtos.', ERROR_CODE.CONFLICT)
  @ResponseMessage('Categoria removida com sucesso.')
  remove(@Param('id') id: string): Promise<null> {
    return this.categories.remove(id)
  }
}
