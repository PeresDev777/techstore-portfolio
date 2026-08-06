import { Injectable } from '@nestjs/common'
import type { Cart, CartItem, Category, Product } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { TransactionClient } from '../../prisma/transaction.service'

export type CartItemWithProduct = CartItem & { product: Product & { category: Category } }
export type CartWithItems = Cart & { items: CartItemWithProduct[] }

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carrinho do usuario com itens e produtos carregados.
   *
   * `include` aninhado resolve tudo em UMA consulta. A alternativa — buscar o carrinho,
   * depois os itens, depois cada produto — e o N+1 classico: um carrinho de dez linhas
   * viraria doze idas ao banco.
   *
   * A ordem por `createdAt` mantem a lista estavel entre requisicoes; sem ela, o Postgres
   * pode devolver as linhas em qualquer ordem e a UI reorganiza os itens sozinha a cada
   * atualizacao.
   */
  findByUserId(userId: string, tx?: TransactionClient): Promise<CartWithItems | null> {
    return (tx ?? this.prisma).cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { product: { include: { category: true } } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    })
  }

  /**
   * Garante que o carrinho exista, sem condicao de corrida.
   *
   * `upsert` sobre a restricao UNIQUE de `user_id` resolve em uma operacao atomica o que
   * um "busca, se nao achar cria" faria em duas — e duas requisicoes simultaneas do mesmo
   * usuario (dois cliques, duas abas) passariam pelo `if` juntas e tentariam criar dois
   * carrinhos. A restricao no banco e o que torna isso impossivel; o upsert e o que evita
   * transformar a colisao em erro.
   */
  async ensureForUser(userId: string): Promise<CartWithItems> {
    await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })

    // Nao-nulo por construcao: o upsert acima acabou de garantir a existencia.
    return (await this.findByUserId(userId)) as CartWithItems
  }

  findItem(cartId: string, productId: string): Promise<CartItem | null> {
    return this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    })
  }

  /**
   * Grava a quantidade FINAL do item, criando a linha se nao existir.
   *
   * Recebe o valor ja calculado e validado pelo service — nao um incremento. A soma
   * acontece antes porque o limite de estoque se aplica ao RESULTADO: somar 3 a um item
   * com 2 unidades e estoque 4 nao pode gravar 5, e `{ increment: 3 }` gravaria.
   */
  async setItemQuantity(cartId: string, productId: string, quantity: number): Promise<void> {
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      update: { quantity },
      create: { cartId, productId, quantity },
    })
  }

  async removeItem(cartId: string, productId: string): Promise<void> {
    await this.prisma.cartItem.delete({
      where: { cartId_productId: { cartId, productId } },
    })
  }

  /** Esvazia o carrinho preservando a linha do carrinho em si. */
  async clear(cartId: string, tx?: TransactionClient): Promise<void> {
    await (tx ?? this.prisma).cartItem.deleteMany({ where: { cartId } })
  }
}
