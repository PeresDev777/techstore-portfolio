import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { unauthenticated } from '../../../common/exceptions/domain.exceptions'
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../../../common/types/authenticated-user'
import { UsersRepository } from '../../users/users.repository'

/**
 * Validacao do access token.
 *
 * O Passport ja verificou assinatura e expiracao antes de `validate` ser chamado. O que
 * fazemos aqui e a segunda metade da pergunta: o token e valido, mas a CONTA ainda e?
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Nunca `true`. Aceitar token expirado transforma o TTL em decoracao.
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.accessSecret'),
    })
  }

  /**
   * Consulta o banco a cada requisicao autenticada — e isso e uma escolha, nao descuido.
   *
   * O JWT ja carrega id, e-mail e papel; confiar apenas neles evitaria a consulta e
   * deixaria a autenticacao verdadeiramente stateless. O preco seria que desativar uma
   * conta, rebaixar um administrador ou excluir um usuario so teria efeito quando o token
   * expirasse — ate 15 minutos de acesso indevido, com o papel ANTIGO.
   *
   * Uma leitura por id, indexada, e barata perto disso. Se um dia o volume justificar,
   * o caminho e cache curto (30 s) com invalidacao na mudanca de papel — nao remover a
   * verificacao.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub)

    if (!user || !user.isActive) {
      throw unauthenticated('Sessão inválida. Faça login novamente.')
    }

    /*
     * O papel vem do BANCO, nao do token. Um administrador rebaixado carrega um token que
     * ainda diz `role: ADMIN`; se a autorizacao acreditasse no token, ele continuaria
     * administrador ate o token expirar.
     */
    return { id: user.id, email: user.email, role: user.role }
  }
}
