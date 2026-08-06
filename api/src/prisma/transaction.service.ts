import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from './prisma.service'

/**
 * Cliente valido dentro de uma transacao. Repositorios recebem isto como parametro
 * opcional e o usam no lugar do PrismaService quando estao participando de uma.
 */
export type TransactionClient = Prisma.TransactionClient

/**
 * Abre uma transacao interativa.
 *
 * Existe para resolver uma tensao real da arquitetura em camadas: fechar um pedido toca
 * TRES repositorios (produtos, carrinho e pedidos) e as tres escritas precisam ser
 * atomicas. Quem conhece a regra — "baixa estoque, grava o pedido, esvazia o carrinho, ou
 * nada disso acontece" — e o service; mas abrir a transacao exigiria que ele chamasse
 * `prisma.$transaction`, furando a regra de que consultas so existem em repositorios.
 *
 * Este servico e a costura: o service depende de uma ABSTRACAO de transacao, nao do
 * Prisma. Ele orquestra; os repositorios continuam donos das consultas.
 *
 * A alternativa seria um metodo gigante no repositorio de pedidos fazendo tudo — o que
 * moveria regra de negocio (validacao de estoque, calculo de totais) para a camada de
 * acesso a dados, exatamente onde ela nao deve estar.
 */
@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(handler: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(handler)
  }
}
