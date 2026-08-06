import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OrderStatus, type Order, type OrderItem } from '@prisma/client'
import type { OrderWithItems } from '../orders.repository'

export class OrderItemEntity {
  @ApiProperty()
  id: string

  @ApiPropertyOptional({
    example: 'prd-001',
    description: 'Nulo quando o produto foi removido do catálogo depois da compra.',
    nullable: true,
  })
  productId: string | null

  @ApiProperty({ example: 'Fone Aurora Pro', description: 'Nome NO MOMENTO da compra.' })
  productName: string

  @ApiProperty({ example: 'fone-aurora-pro' })
  productSlug: string

  @ApiProperty({ example: 129990, description: 'Preço unitário cobrado, em centavos.' })
  unitPrice: number

  @ApiProperty({ example: 2 })
  quantity: number

  @ApiProperty({ example: 259980 })
  lineTotal: number

  static from(item: OrderItem): OrderItemEntity {
    const entity = new OrderItemEntity()

    entity.id = item.id
    entity.productId = item.productId
    entity.productName = item.productName
    entity.productSlug = item.productSlug
    entity.unitPrice = item.unitPriceInCents
    entity.quantity = item.quantity
    entity.lineTotal = item.lineTotalInCents

    return entity
  }
}

export class OrderTotalsEntity {
  @ApiProperty({ example: 259980 })
  subtotal: number

  @ApiProperty({ example: 0 })
  shipping: number

  @ApiProperty({ example: 259980 })
  total: number
}

export class OrderCustomerEntity {
  @ApiProperty() fullName: string
  @ApiProperty() email: string
  @ApiProperty({ description: 'Somente dígitos.' }) cpf: string
  @ApiProperty({ description: 'Somente dígitos.' }) phone: string
}

export class OrderAddressEntity {
  @ApiProperty({ description: 'Somente dígitos.' }) zipCode: string
  @ApiProperty() street: string
  @ApiProperty() number: string
  @ApiPropertyOptional({ nullable: true }) complement: string | null
  @ApiProperty() district: string
  @ApiProperty() city: string
  @ApiProperty() state: string
}

/**
 * Resumo do pedido, usado na LISTAGEM.
 *
 * Sem os itens de proposito: uma tela de historico mostra numero, data, status e total.
 * Carregar todos os itens de todos os pedidos para renderizar isso e payload desperdicado,
 * e o desperdicio cresce com o tamanho de cada compra. `itemCount` cobre o "3 itens" que a
 * lista costuma exibir.
 */
export class OrderSummaryEntity {
  @ApiProperty({ example: 'TS-4F2A9C' })
  id: string

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus

  @ApiProperty({ example: '2026-08-06T12:00:00.000Z' })
  placedAt: Date

  @ApiPropertyOptional({ nullable: true })
  canceledAt: Date | null

  @ApiProperty({ example: 3, description: 'Soma das quantidades.' })
  itemCount: number

  @ApiProperty({ type: OrderTotalsEntity })
  totals: OrderTotalsEntity

  static from(order: OrderWithItems): OrderSummaryEntity {
    const entity = new OrderSummaryEntity()

    entity.id = order.id
    entity.status = order.status
    entity.placedAt = order.placedAt
    entity.canceledAt = order.canceledAt
    entity.itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
    entity.totals = toTotals(order)

    return entity
  }

  static fromMany(orders: OrderWithItems[]): OrderSummaryEntity[] {
    return orders.map((order) => OrderSummaryEntity.from(order))
  }
}

/**
 * Pedido completo.
 *
 * Comprador, endereco, itens e totais sao SNAPSHOTS gravados no fechamento. Nada aqui e
 * lido do catalogo ou do cadastro atual: o pedido registra o que foi comprado e cobrado
 * naquele momento, e continua igual mesmo que preco, nome do produto ou e-mail do cliente
 * mudem depois.
 */
export class OrderEntity extends OrderSummaryEntity {
  @ApiProperty({ type: OrderCustomerEntity })
  customer: OrderCustomerEntity

  @ApiProperty({ type: OrderAddressEntity })
  address: OrderAddressEntity

  @ApiProperty({ type: [OrderItemEntity] })
  items: OrderItemEntity[]

  static override from(order: OrderWithItems): OrderEntity {
    const entity = new OrderEntity()

    entity.id = order.id
    entity.status = order.status
    entity.placedAt = order.placedAt
    entity.canceledAt = order.canceledAt
    entity.itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
    entity.totals = toTotals(order)

    entity.customer = {
      fullName: order.customerName,
      email: order.customerEmail,
      cpf: order.customerCpf,
      phone: order.customerPhone,
    }

    entity.address = {
      zipCode: order.zipCode,
      street: order.street,
      number: order.number,
      complement: order.complement,
      district: order.district,
      city: order.city,
      state: order.state,
    }

    entity.items = order.items.map((item) => OrderItemEntity.from(item))

    return entity
  }
}

function toTotals(order: Order): OrderTotalsEntity {
  return {
    subtotal: order.subtotalInCents,
    shipping: order.shippingInCents,
    total: order.totalInCents,
  }
}
