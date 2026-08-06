import { Injectable } from '@nestjs/common'
import type { RefreshToken, User } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

/** Token com o dono carregado — evita uma segunda ida ao banco na renovacao. */
export type RefreshTokenWithUser = RefreshToken & { user: User }

export interface CreateRefreshTokenData {
  tokenHash: string
  userId: string
  familyId: string
  expiresAt: Date
  userAgent?: string | null
  ipAddress?: string | null
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data })
  }

  /**
   * Busca pelo hash trazendo o dono junto.
   *
   * O `include` evita a sequencia "acha o token, depois busca o usuario" — duas idas ao
   * banco no caminho mais quente da API, ja que toda renovacao passa por aqui.
   */
  findByHash(tokenHash: string): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  /**
   * Revoga toda a familia de tokens.
   *
   * Chamado em duas situacoes: logout (encerra a sessao inteira, nao so o token atual) e
   * deteccao de reuso — quando um token ja rotacionado reaparece, ou ele foi roubado ou a
   * copia legitima esta em outro lugar. Nao da para saber qual dos dois; derrubar a
   * familia forca um login novo e e a unica resposta segura.
   *
   * `updateMany` com `revokedAt: null` no filtro evita reescrever tokens ja revogados.
   */
  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    return result.count
  }

  /**
   * Rotacao atomica: revoga o token apresentado e grava o sucessor na mesma transacao.
   *
   * Em duas escritas separadas, uma queda no meio deixaria o token antigo valido e o novo
   * ja entregue ao cliente — dois tokens vivos na mesma familia, que e exatamente o
   * padrao que a deteccao de reuso interpreta como roubo.
   */
  async rotate(currentId: string, next: CreateRefreshTokenData): Promise<RefreshToken> {
    const [, created] = await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: currentId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({ data: next }),
    ])

    return created
  }
}
