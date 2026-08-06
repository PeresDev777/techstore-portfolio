import { Injectable } from '@nestjs/common'
import type { Prisma, User } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Unico ponto do modulo de usuarios que conhece o Prisma.
 *
 * O service acima nao sabe se os dados vem de Postgres, de outro servico ou de memoria —
 * e essa ignorancia e o que permite testa-lo com um dublê, sem banco.
 *
 * Repare que TODA leitura filtra `deletedAt: null`. A exclusao e logica (o usuario
 * referencia pedidos), entao "existe" e uma decisao que precisa ser tomada em cada
 * consulta. Centralizar isso aqui e o que impede que uma consulta esquecida devolva uma
 * conta excluida.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Usado no login. Conta excluida nao autentica. */
  findActiveByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    })
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } })
  }

  /**
   * Checagem de e-mail livre, IGNORANDO exclusao logica.
   *
   * Uma conta excluida continua ocupando o e-mail, porque a coluna e UNIQUE no banco e a
   * linha nao sai de la. Liberar o endereco exigiria mascara-lo na exclusao
   * (`user+deleted-<id>@...`), o que quebraria o e-mail que ficou registrado nos pedidos
   * daquele cliente. Entre um cadastro recusado e um historico de compras adulterado, o
   * historico vence.
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email: email.toLowerCase() } })
    return count > 0
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data })
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data })
  }

  /**
   * Exclusao logica + invalidacao de todas as sessoes, em UMA transacao.
   *
   * Fora de transacao, uma falha entre as duas escritas deixaria uma conta "excluida" com
   * refresh tokens vivos — o usuario continuaria renovando sessao de uma conta que nao
   * existe mais.
   */
  async softDelete(id: string): Promise<void> {
    const now = new Date()

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: now, isActive: false },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ])
  }

  /**
   * Listagem paginada.
   *
   * `$transaction` com as duas consultas garante que a contagem e a pagina venham do MESMO
   * instante. Executadas soltas, um cadastro entre uma e outra produz `total: 51` com uma
   * pagina que nao corresponde — a paginacao passa a "pular" um registro.
   */
  findManyPaginated(skip: number, take: number): Promise<[User[], number]> {
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        // Desempate por id: sem ele, dois usuarios criados no mesmo milissegundo podem
        // sair em ordem diferente a cada consulta — e um teste falha uma vez em dez.
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ])
  }
}
