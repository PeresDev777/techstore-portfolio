import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { conflict, insufficientStock, notFound } from '../../common/exceptions/domain.exceptions'
import { PaginatedResult } from '../../common/dto/paginated-result'
import { TransactionService, type TransactionClient } from '../../prisma/transaction.service'
import { calculateTotals } from '../cart/cart-totals'
import { CartRepository } from '../cart/cart.repository'
import { ProductsRepository } from '../products/products.repository'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { OrderQueryDto } from './dto/order-query.dto'
import { OrderEntity, OrderSummaryEntity } from './entities/order.entity'
import { ORDER_NUMBER_ATTEMPTS, generateOrderNumber } from './order-number'
import { OrdersRepository, type OrderWithItems } from './orders.repository'

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)

  constructor(
    private readonly orders: OrdersRepository,
    private readonly carts: CartRepository,
    private readonly products: ProductsRepository,
    private readonly transactions: TransactionService,
  ) {}

  /**
   * Fecha o pedido a partir do carrinho, em UMA transacao.
   *
   * Ou tudo acontece — baixa de estoque, criacao do pedido, esvaziamento do carrinho — ou
   * nada acontece. Sem a transacao, uma falha no meio deixaria o pior estado possivel:
   * estoque debitado sem pedido registrado, ou pedido criado com o carrinho ainda cheio,
   * pronto para ser comprado de novo.
   */
  async create(userId: string, dto: CreateOrderDto): Promise<OrderEntity> {
    /*
     * O retry envolve a TRANSACAO INTEIRA, e nao apenas a geracao do numero.
     *
     * Quando um numero colide, a insercao ja falhou e a transacao esta abortada — o
     * Postgres recusa qualquer comando seguinte nela. Reaproveitar o estoque ja debitado
     * seria impossivel; refazer tudo do zero e o unico caminho correto.
     */
    for (let attempt = 1; attempt <= ORDER_NUMBER_ATTEMPTS; attempt++) {
      try {
        return await this.transactions.run((tx) => this.placeOrder(userId, dto, tx))
      } catch (error) {
        if (this.isOrderNumberCollision(error) && attempt < ORDER_NUMBER_ATTEMPTS) {
          this.logger.warn(`Colisao de numero de pedido; tentativa ${attempt + 1}.`)
          continue
        }

        throw error
      }
    }

    // Inalcancavel na pratica: exigiria cinco colisoes seguidas em 16.7 milhoes.
    throw conflict('Não foi possível gerar o número do pedido. Tente novamente.')
  }

  private async placeOrder(
    userId: string,
    dto: CreateOrderDto,
    tx: TransactionClient,
  ): Promise<OrderEntity> {
    const cart = await this.carts.findByUserId(userId, tx)

    /*
     * Revalidacao no servidor, mesmo com a UI ja impedindo.
     *
     * A validacao do cliente e conveniencia; a do servidor e a que vale — a requisicao
     * pode vir de qualquer lugar. Mesmo principio que o mock do frontend ja aplicava
     * (`orderService.ts`: "o servico nao confia na UI").
     */
    if (!cart || cart.items.length === 0) {
      throw conflict('Não há itens no pedido.')
    }

    const lines = []

    for (const item of cart.items) {
      const product = item.product

      if (!product.isActive) {
        throw conflict(`"${product.name}" não está mais disponível. Remova o item do carrinho.`, [
          { field: 'items', message: 'Produto fora de catálogo.' },
        ])
      }

      /*
       * A baixa acontece ANTES de montar o pedido, e a guarda condicional esta no proprio
       * UPDATE (ver `decrementStock`). Se duas pessoas disputam a ultima unidade, o banco
       * serializa as duas transacoes e a segunda encontra zero linhas afetadas.
       *
       * Comparar o estoque em JavaScript e depois gravar deixaria uma janela entre a
       * leitura e a escrita — o bug que vende duas vezes o mesmo item.
       */
      const debited = await this.products.decrementStock(product.id, item.quantity, tx)

      if (!debited) {
        throw insufficientStock(`Estoque insuficiente para "${product.name}".`, [
          { field: 'items', message: `Disponível: ${product.stock}.` },
        ])
      }

      /*
       * Preco lido do BANCO dentro da transacao, nunca do corpo da requisicao. E o que
       * impede um pedido de R$ 0,01: o cliente escolhe o que comprar, o servidor decide
       * quanto custa.
       */
      lines.push({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        unitPriceInCents: product.priceInCents,
        quantity: item.quantity,
        lineTotalInCents: product.priceInCents * item.quantity,
      })
    }

    // Mesma funcao de totais do carrinho: uma unica regra de frete no sistema inteiro.
    const totals = calculateTotals(
      lines.map((line) => ({ priceInCents: line.unitPriceInCents, quantity: line.quantity })),
    )

    const order = await this.orders.create(
      {
        id: generateOrderNumber(),
        user: { connect: { id: userId } },
        status: OrderStatus.PENDING,

        subtotalInCents: totals.subtotal,
        shippingInCents: totals.shipping,
        totalInCents: totals.total,

        customerName: dto.customer.fullName,
        customerEmail: dto.customer.email,
        customerCpf: dto.customer.cpf,
        customerPhone: dto.customer.phone,

        zipCode: dto.address.zipCode,
        street: dto.address.street,
        number: dto.address.number,
        complement: dto.address.complement ?? null,
        district: dto.address.district,
        city: dto.address.city,
        state: dto.address.state,

        items: { create: lines },
      },
      tx,
    )

    // O carrinho e consumido: os itens viraram um pedido e nao devem ser comprados de novo.
    await this.carts.clear(cart.id, tx)

    return OrderEntity.from(order)
  }

  async findAll(
    userId: string,
    query: OrderQueryDto,
  ): Promise<PaginatedResult<OrderSummaryEntity>> {
    const [orders, total] = await this.orders.findManyForUser(
      userId,
      query.status,
      query.skip,
      query.limit,
    )

    return PaginatedResult.create(
      OrderSummaryEntity.fromMany(orders),
      total,
      query.page,
      query.limit,
    )
  }

  async findById(userId: string, id: string): Promise<OrderEntity> {
    return OrderEntity.from(await this.requireOrder(userId, id))
  }

  /**
   * Cancela o pedido e DEVOLVE o estoque, em uma transacao.
   *
   * Cancelar sem devolver estoque tira do catalogo unidades que ninguem comprou — um erro
   * silencioso que so aparece quando o produto "esgota" com o deposito cheio.
   */
  async cancel(userId: string, id: string): Promise<OrderEntity> {
    return this.transactions.run(async (tx) => {
      const order = await this.orders.findByIdForUser(id, userId, tx)

      if (!order) throw this.notFound()

      this.assertCancelable(order)

      /*
       * A transicao e CONDICIONAL ao estado atual (`updateMany` com `status: PENDING` no
       * where). Duas requisicoes simultaneas de cancelamento passariam juntas pela
       * verificacao acima; so uma altera a linha, e a outra sabe que perdeu — sem isso, o
       * estoque seria devolvido DUAS vezes para o mesmo pedido.
       */
      const transitioned = await this.orders.transitionStatus(
        order.id,
        OrderStatus.PENDING,
        OrderStatus.CANCELED,
        tx,
      )

      if (!transitioned) {
        throw conflict('Este pedido já foi processado por outra requisição.')
      }

      for (const item of order.items) {
        // `productId` e nulo quando o produto foi removido do catalogo (onDelete: SetNull).
        // Nao ha estoque para devolver, e o item permanece no historico pelo snapshot.
        if (item.productId) {
          await this.products.restoreStock(item.productId, item.quantity, tx)
        }
      }

      return OrderEntity.from(await this.requireOrder(userId, id, tx))
    })
  }

  /**
   * Confirmacao de pagamento — SIMULADA.
   *
   * Nao existe gateway neste projeto. O endpoint existe para que `PAID` seja um estado
   * ALCANCAVEL: um enum com valor que nenhuma operacao produz e documentacao mentindo
   * sobre o sistema. Com ele, o ciclo fica completo e testavel — e "cancelar pedido pago"
   * passa a ser um cenario real de conflito, em vez de hipotese.
   */
  async pay(userId: string, id: string): Promise<OrderEntity> {
    const order = await this.requireOrder(userId, id)

    if (order.status !== OrderStatus.PENDING) {
      throw conflict(
        order.status === OrderStatus.PAID
          ? 'Este pedido já está pago.'
          : 'Um pedido cancelado não pode ser pago.',
      )
    }

    await this.orders.transitionStatus(order.id, OrderStatus.PENDING, OrderStatus.PAID)

    return OrderEntity.from(await this.requireOrder(userId, id))
  }

  // -------------------------------------------------------------------------

  private assertCancelable(order: OrderWithItems): void {
    if (order.status === OrderStatus.CANCELED) {
      throw conflict('Este pedido já foi cancelado.')
    }

    if (order.status === OrderStatus.PAID) {
      /*
       * Pedido pago exige estorno, nao cancelamento simples — e estorno envolve o meio de
       * pagamento, que este projeto nao tem. Recusar e mais honesto que fingir que o
       * dinheiro voltou.
       */
      throw conflict('Pedidos pagos não podem ser cancelados. Solicite o estorno ao suporte.')
    }
  }

  private async requireOrder(
    userId: string,
    id: string,
    tx?: TransactionClient,
  ): Promise<OrderWithItems> {
    const order = await this.orders.findByIdForUser(id, userId, tx)

    if (!order) throw this.notFound()

    return order
  }

  /** 404 tambem para pedido de outra pessoa — ver `findByIdForUser`. */
  private notFound(): NotFoundException {
    return notFound('Pedido não encontrado.')
  }

  /** Colisao de chave primaria na tabela de pedidos, ou seja: numero repetido. */
  private isOrderNumberCollision(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  }
}
