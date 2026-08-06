import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { ERROR_CODE } from '../../common/constants/error-codes'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import {
  ApiErrorResponse,
  ApiNoDataResponse,
  ApiSuccessResponse,
} from '../../common/swagger/api-envelope.decorators'
import type { AuthenticatedUser } from '../../common/types/authenticated-user'
import { UserEntity } from '../users/entities/user.entity'
import { UsersService } from '../users/users.service'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { RegisterDto } from './dto/register.dto'
import { AuthSessionEntity, RefreshedTokensEntity } from './entities/auth-session.entity'
import type { SessionContext } from './token.service'

@ApiTags('Autenticação')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cria uma conta de cliente.' })
  @ApiSuccessResponse(UserEntity, { status: 201 })
  @ApiErrorResponse(409, 'E-mail já cadastrado.', ERROR_CODE.CONFLICT)
  @ApiErrorResponse(422, 'Dados inválidos.', ERROR_CODE.VALIDATION_ERROR)
  @ResponseMessage('Conta criada com sucesso.')
  register(@Body() dto: RegisterDto): Promise<UserEntity> {
    return this.auth.register(dto)
  }

  @Public()
  @Post('login')
  /*
   * 200 e nao 201: o POST nao criou recurso nenhum, ele abriu uma sessao. O padrao do Nest
   * para POST e 201, entao a anotacao e necessaria — e um teste que assevera o status
   * flagraria a diferenca.
   */
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e devolve os tokens da sessão.' })
  @ApiSuccessResponse(AuthSessionEntity)
  @ApiErrorResponse(401, 'E-mail ou senha inválidos.', ERROR_CODE.INVALID_CREDENTIALS)
  @ApiErrorResponse(403, 'Conta desativada.', ERROR_CODE.ACCOUNT_DISABLED)
  @ResponseMessage('Autenticação realizada com sucesso.')
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<AuthSessionEntity> {
    return this.auth.login(dto, this.sessionContext(request))
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Troca o refresh token por um novo par de tokens.' })
  @ApiSuccessResponse(RefreshedTokensEntity)
  @ApiErrorResponse(401, 'Sessão inválida, expirada ou encerrada.', ERROR_CODE.UNAUTHENTICATED)
  @ResponseMessage('Sessão renovada com sucesso.')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<RefreshedTokensEntity> {
    /*
     * Rota PUBLICA de propósito: quem chama aqui esta justamente com o access token
     * vencido. Exigir autenticacao para renovar autenticacao seria um impasse. A prova de
     * identidade e o proprio refresh token.
     */
    return this.auth.refresh(dto.refreshToken, this.sessionContext(request))
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encerra a sessão, revogando a família de refresh tokens.' })
  @ApiNoDataResponse('Sessão encerrada.')
  @ResponseMessage('Logout realizado com sucesso.')
  async logout(@Body() dto: RefreshTokenDto): Promise<null> {
    await this.auth.logout(dto.refreshToken)

    /*
     * 200 com envelope, e nao 204.
     *
     * 204 significa "sem conteudo" — e um corpo `{ success, message, data }` e conteudo.
     * Entre abrir uma excecao no formato de resposta e usar 200 num caso sem dados, a
     * consistencia vale mais: o cliente e a suite tratam toda resposta igual.
     */
    return null
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dados do usuário autenticado.' })
  @ApiSuccessResponse(UserEntity)
  @ApiErrorResponse(401, 'Autenticação necessária.', ERROR_CODE.UNAUTHENTICATED)
  @ResponseMessage('Usuário autenticado recuperado com sucesso.')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserEntity> {
    return this.users.findById(user.id)
  }

  /**
   * Contexto da sessao para auditoria.
   *
   * `request.ip` respeita `trust proxy`; atras de um balanceador sem essa configuracao,
   * todos os acessos apareceriam com o IP do proxy. Fica registrado como ponto a revisar
   * no deploy — nao ha proxy neste ambiente.
   */
  private sessionContext(request: Request): SessionContext {
    return {
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress: request.ip ?? null,
    }
  }
}
