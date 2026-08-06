import { Injectable } from '@nestjs/common'
import type { User } from '@prisma/client'
import {
  accountDisabled,
  conflict,
  invalidCredentials,
} from '../../common/exceptions/domain.exceptions'
import { UsersRepository } from '../users/users.repository'
import { UserEntity } from '../users/entities/user.entity'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'
import type { AuthSessionEntity, RefreshedTokensEntity } from './entities/auth-session.entity'
import { PasswordService } from './password.service'
import { TokenService, type SessionContext } from './token.service'

/**
 * Regras de autenticacao.
 *
 * Nenhum metodo aqui conhece `Request` ou `Response` — recebem DTOs e um `SessionContext`
 * simples. E o que permite testar "conta desativada nao autentica" sem subir HTTP.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<UserEntity> {
    if (await this.users.emailExists(dto.email)) {
      /*
       * Aqui o vazamento de "este e-mail existe" e inevitavel: nao ha como cadastrar duas
       * contas com o mesmo endereco e tambem nao dizer isso a quem tentou. O padrao da
       * industria para fechar essa brecha e responder 201 sempre e mandar um e-mail
       * ("alguem tentou criar uma conta com o seu endereco"), o que exige servico de
       * e-mail. Fica registrado como escolha consciente, nao como descuido.
       */
      throw conflict('Este e-mail já está cadastrado.', [
        { field: 'email', message: 'E-mail já cadastrado.' },
      ])
    }

    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
    })

    /*
     * O cadastro NAO devolve sessao — devolve o usuario criado.
     *
     * Autenticar automaticamente pareceria conveniente, mas faz o cliente ter dois
     * caminhos diferentes para obter uma sessao, e um deles pula o login. Quando entrar
     * confirmacao de e-mail, esse atalho vira brecha: conta nao verificada ja logada.
     */
    return UserEntity.from(user)
  }

  async login(dto: LoginDto, context: SessionContext): Promise<AuthSessionEntity> {
    const user = await this.users.findActiveByEmail(dto.email)

    if (!user) {
      // Gasta o mesmo tempo de uma verificacao real antes de recusar (ver PasswordService).
      await this.passwords.fakeCompare()
      throw invalidCredentials()
    }

    const passwordMatches = await this.passwords.compare(dto.password, user.passwordHash)

    if (!passwordMatches) {
      throw invalidCredentials()
    }

    /*
     * A checagem de conta desativada vem DEPOIS da senha, e a ordem e deliberada.
     *
     * Invertida, qualquer pessoa descobriria contas desativadas sem saber a senha delas.
     * Como esta, so quem ja provou ser o dono recebe a informacao de que a conta esta
     * suspensa — que e justamente quem precisa dela para procurar o suporte.
     */
    if (!user.isActive) {
      throw accountDisabled()
    }

    const tokens = await this.tokens.issueSession(user, context)

    return {
      user: UserEntity.from(user),
      tokenType: 'Bearer',
      ...tokens,
    }
  }

  async refresh(refreshToken: string, context: SessionContext): Promise<RefreshedTokensEntity> {
    const stored = await this.tokens.resolveRefreshToken(refreshToken)

    /*
     * A conta pode ter sido desativada ou excluida DEPOIS do login. Sem esta checagem, um
     * usuario banido continuaria renovando a sessao indefinidamente — o banimento so
     * valeria no proximo login, que ele nunca precisaria fazer.
     */
    this.assertUsable(stored.user)

    const tokens = await this.tokens.rotate(stored, context)

    return { tokenType: 'Bearer', ...tokens }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeSession(refreshToken)
  }

  private assertUsable(user: User): void {
    if (!user.isActive || user.deletedAt) {
      throw accountDisabled()
    }
  }
}
