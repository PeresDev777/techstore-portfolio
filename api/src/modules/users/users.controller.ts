import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { PaginatedResult } from '../../common/dto/paginated-result'
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import {
  ApiErrorResponse,
  ApiNoDataResponse,
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from '../../common/swagger/api-envelope.decorators'
import type { AuthenticatedUser } from '../../common/types/authenticated-user'
import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { UserEntity } from './entities/user.entity'
import { UsersService } from './users.service'

@ApiTags('Usuários')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /*
   * As rotas `/me` vem ANTES de `/:id`. O Express casa na ordem de registro, entao com a
   * ordem invertida `GET /users/me` seria capturado por `:id` e viraria uma busca pelo
   * usuario de id "me" — 404 confuso, e um bug que so aparece depois que a rota dinamica
   * e adicionada.
   */

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário autenticado.' })
  @ApiSuccessResponse(UserEntity)
  @ResponseMessage('Perfil recuperado com sucesso.')
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<UserEntity> {
    return this.users.findById(user.id)
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualiza nome e/ou e-mail do usuário autenticado.' })
  @ApiSuccessResponse(UserEntity)
  @ApiErrorResponse(409, 'E-mail já cadastrado.', ERROR_CODE.CONFLICT)
  @ResponseMessage('Perfil atualizado com sucesso.')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    /*
     * O id vem do TOKEN, nunca do corpo ou da URL.
     *
     * Se a rota fosse `PATCH /users/:id`, seria preciso comparar `:id` com o usuario
     * autenticado em toda chamada — e esquecer essa comparacao uma vez significa permitir
     * que qualquer pessoa edite o perfil de qualquer outra (IDOR, uma das falhas mais
     * comuns em API REST). Com `/me`, a falha e estruturalmente impossivel.
     */
    return this.users.updateProfile(user.id, dto)
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Troca a senha (exige a senha atual).' })
  @ApiNoDataResponse('Senha alterada.')
  @ApiErrorResponse(409, 'Senha atual incorreta.', ERROR_CODE.CONFLICT)
  @ResponseMessage('Senha alterada com sucesso.')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<null> {
    return this.users.changePassword(user.id, dto)
  }

  @Delete('me')
  @ApiOperation({ summary: 'Exclui a própria conta (exclusão lógica).' })
  @ApiNoDataResponse('Conta excluída e sessões revogadas.')
  @ResponseMessage('Conta excluída com sucesso.')
  removeMe(@CurrentUser() user: AuthenticatedUser): Promise<null> {
    return this.users.remove(user.id)
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lista usuários (administrador).' })
  @ApiPaginatedResponse(UserEntity)
  @ApiErrorResponse(403, 'Sem permissão.', ERROR_CODE.FORBIDDEN)
  @ResponseMessage('Usuários listados com sucesso.')
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResult<UserEntity>> {
    return this.users.findAll(query)
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Busca um usuário por id (administrador).' })
  @ApiSuccessResponse(UserEntity)
  @ApiErrorResponse(404, 'Usuário não encontrado.', ERROR_CODE.NOT_FOUND)
  @ResponseMessage('Usuário recuperado com sucesso.')
  findOne(@Param('id') id: string): Promise<UserEntity> {
    return this.users.findById(id)
  }
}
