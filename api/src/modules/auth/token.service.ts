import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { User } from '@prisma/client'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { ERROR_CODE } from '../../common/constants/error-codes'
import type { AccessTokenPayload } from '../../common/types/authenticated-user'
import { RefreshTokenRepository, type RefreshTokenWithUser } from './refresh-token.repository'

export interface SessionContext {
  userAgent?: string | null
  ipAddress?: string | null
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Ciclo de vida dos tokens.
 *
 * A separacao entre `resolveRefreshToken` e `rotate` e proposital: a primeira responde
 * "este token e valido e de quem e?", a segunda executa a troca. Entre as duas, a
 * AuthService decide se a CONTA pode continuar — regra de negocio que nao pertence aqui.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  /** Login: abre uma familia nova de tokens. */
  issueSession(user: User, context: SessionContext): Promise<IssuedTokens> {
    return this.issue(user, randomUUID(), context)
  }

  /**
   * Valida o refresh token apresentado e devolve o registro com o dono.
   *
   * Lanca 401 em todos os caminhos de falha, com mensagens diferentes apenas para o que o
   * usuario legitimo precisa saber (expirou x foi encerrada) — nunca revelando se o token
   * existe na base.
   */
  async resolveRefreshToken(presentedToken: string): Promise<RefreshTokenWithUser> {
    const stored = await this.refreshTokens.findByHash(this.hashToken(presentedToken))

    if (!stored) {
      throw this.invalidSession('Sessão inválida. Faça login novamente.')
    }

    /*
     * DETECCAO DE REUSO.
     *
     * O token existe, mas ja foi rotacionado. Isso nao acontece em uso normal: o cliente
     * legitimo descarta o antigo assim que recebe o novo. Duas explicacoes possiveis — o
     * token vazou e o atacante o esta usando, ou vazou e o LEGITIMO o esta usando enquanto
     * o atacante ja rotacionou. Nao ha como distinguir, entao derrubamos a familia inteira
     * e exigimos login novo. No pior caso, uma sessao legitima e interrompida; a
     * alternativa e manter uma sessao roubada viva.
     */
    if (stored.revokedAt) {
      const revoked = await this.refreshTokens.revokeFamily(stored.familyId)

      this.logger.warn(
        `Reuso de refresh token detectado (usuario ${stored.userId}, familia ${stored.familyId}). ` +
          `${revoked} token(s) revogado(s).`,
      )

      throw this.invalidSession('Sessão encerrada por segurança. Faça login novamente.')
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw this.invalidSession('Sessão expirada. Faça login novamente.')
    }

    return stored
  }

  /**
   * Rotacao: queima o token apresentado e emite o sucessor na MESMA familia.
   *
   * Cada uso invalida o anterior, entao a janela em que um refresh roubado serve para
   * alguma coisa passa a ser "ate o dono usar o dele" em vez de "sete dias".
   */
  rotate(stored: RefreshTokenWithUser, context: SessionContext): Promise<IssuedTokens> {
    return this.issue(stored.user, stored.familyId, context, stored.id)
  }

  /** Logout: encerra a linhagem inteira, nao apenas o token apresentado. */
  async revokeSession(presentedToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(this.hashToken(presentedToken))

    /*
     * Silencio proposital quando o token nao existe. Responder "este token nao existe"
     * transformaria o logout em um oraculo para descobrir quais tokens sao validos. Para o
     * cliente, o resultado observavel e o mesmo: a sessao acabou.
     */
    if (!stored) return

    await this.refreshTokens.revokeFamily(stored.familyId)
  }

  private async issue(
    user: User,
    familyId: string,
    context: SessionContext,
    rotatingFromId?: string,
  ): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = await this.jwt.signAsync(payload)

    /*
     * O refresh token e uma string aleatoria OPACA, nao um JWT.
     *
     * Um JWT carrega claims legiveis por quem o tiver e vale enquanto a assinatura valer.
     * Aqui a validade e decidida pelo banco, entao nao ha nada que o token precise
     * carregar — e nada que ele possa vazar. 32 bytes de aleatoriedade criptografica sao
     * inalcancaveis por forca bruta.
     */
    const refreshToken = randomBytes(32).toString('base64url')

    const data = {
      tokenHash: this.hashToken(refreshToken),
      userId: user.id,
      familyId,
      expiresAt: this.refreshExpiration(),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    }

    if (rotatingFromId) {
      await this.refreshTokens.rotate(rotatingFromId, data)
    } else {
      await this.refreshTokens.create(data)
    }

    return { accessToken, refreshToken, expiresIn: this.accessTokenLifetimeInSeconds(accessToken) }
  }

  /**
   * SHA-256 e nao bcrypt — de proposito, e a razao importa.
   *
   * bcrypt e lento por design para resistir a ataque de dicionario sobre senhas humanas,
   * que tem pouca entropia. Um refresh token e 256 bits aleatorios: nao existe dicionario
   * que o alcance, entao a lentidao nao compra nada. Alem disso o salt do bcrypt e novo a
   * cada chamada, o que impossibilitaria a busca por hash — seria preciso varrer a tabela
   * comparando linha a linha, em toda renovacao.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private refreshExpiration(): Date {
    const days = this.config.getOrThrow<number>('auth.refreshTtlDays')
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }

  /**
   * Segundos restantes do access token, lidos do proprio `exp`.
   *
   * Derivado do token e nao da configuracao: se o TTL mudar, o cliente continua recebendo
   * o valor real daquele token, e nao o que o `.env` diz que deveria ser.
   */
  private accessTokenLifetimeInSeconds(accessToken: string): number {
    const decoded = this.jwt.decode<AccessTokenPayload | null>(accessToken)

    if (!decoded?.exp) return 0

    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
  }

  private invalidSession(message: string): UnauthorizedException {
    return new UnauthorizedException({ message, code: ERROR_CODE.UNAUTHENTICATED })
  }
}
