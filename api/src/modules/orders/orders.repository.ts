import { Injectable } from '@nestjs/common'
import { OrderStatus, type Order, type OrderItem, type Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { TransactionClient } from '../../prisma/transaction.service'

export type OrderWithItems = Order & { items: OrderItem[] }

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria o pedido com os itens em uma unica operacao.
   *
   * `items: { create: [...] }` gera pedido e itens juntos — em vez de criar o pedido,
   * pegar o id e inserir cada item, que seriam N+1 escritas dentro da transacao,
   * segurando os locks de estoque por mais tempo.
   */
  create(data: Prisma.OrderCreateInput, tx?: TransactionClient): Promise<OrderWithItems> {
    return (tx ?? this.prisma).order.create({ data, include: { items: true } })
  }

  /**
   * Busca SEMPRE filtrando pelo dono.
   *
   * O `userId` faz parte do `where`, e nao de uma comparacao depois da consulta. A
   * diferenca aparece na resposta: um pedido de outra pessoa nao e encontrado, entao a API
   * devolve 404 e nao 403.
   *
   * Isso e deliberado. Um 403 confirmaria que aquele numero de pedido EXISTE, e numeros
   * curtos como `TS-4F2A9C` sao enumeraveis — daria para mapear o volume de vendas da loja
   * varrendo combinacoes. O 404 nao distingue "nao e seu" de "nao existe".
   */
  findByIdForUser(
    id: string,
    userId: string,
    tx?: TransactionClient,
  ): Promise<OrderWithItems | null> {
    return (tx ?? this.prisma).order.findFirst({
      where: { id, userId },
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    })
  }

  /** Historico do usuario, do mais recente para o mais antigo. */
  findManyForUser(
    userId: string,
    status: OrderStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[OrderWithItems[], number]> {
    const where: Prisma.OrderWhereInput = { userId, ...(status ? { status } : {}) }

    return this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        // Desempate por id: dois pedidos no mesmo milissegundo sairiam em ordem instavel.
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ])
  }

  /**
   * Muda o status apenas se o pedido AINDA estiver no estado esperado.
   *
   * `updateMany` com o status atual no `where` transforma a transicao em uma operacao
   * condicional: se outra requisicao ja cancelou o pedido entre a leitura e a escrita, o
   * update afeta zero linhas e o service sabe que perdeu a corrida. Um `update` simples
   * sobrescreveria o estado alheio sem perceber — e um pedido cancelado voltaria a
   * PENDING, ou um pedido pago seria cancelado depois do pagamento.
   */
  async transitionStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    tx?: TransactionClient,
  ): Promise<boolean> {
    const result = await (tx ?? this.prisma).order.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        ...(to === OrderStatus.CANCELED ? { canceledAt: new Date() } : {}),
      },
    })

    return result.count > 0
  }
}
