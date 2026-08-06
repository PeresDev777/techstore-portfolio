import { request } from '@/services/http'
import type { CreateOrderInput, Order } from '@/types/order'
import type { CartItem, CartTotals } from '@/types/cart'

/**
 * Serviço de pedidos.
 *
 * O fechamento acontece em UMA transação no servidor: baixa de estoque com guarda
 * condicional, gravação do pedido com snapshot de comprador, endereço e preços, e
 * esvaziamento do carrinho. Falhou qualquer etapa, nada acontece (ADR-038 da API).
 */

/** Item como a API devolve — snapshot congelado no momento da compra. */
interface ApiOrderItem {
  id: string
  productId: string | null
  productName: string
  productSlug: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

interface ApiOrder {
  id: string
  status: 'PENDING' | 'PAID' | 'CANCELED'
  placedAt: string
  itemCount: number
  totals: { subtotal: number; shipping: number; total: number }
  customer: { fullName: string; email: string; cpf: string; phone: string }
  address: {
    zipCode: string
    street: string
    number: string
    complement: string | null
    district: string
    city: string
    state: string
  }
  items: ApiOrderItem[]
}

/**
 * Converte o pedido da API para a forma que a tela de sucesso já consome.
 *
 * O `Order` da aplicação carrega `items: CartItem[]`, ou seja, produtos completos. O
 * pedido da API carrega SNAPSHOTS — nome e preço no momento da compra, sem o produto
 * atual. A diferença é proposital do lado do servidor: reajustar um preço não pode
 * reescrever o histórico.
 *
 * Aqui reconstruímos o suficiente para a exibição. Os campos que a tela não usa
 * (descrição, avaliação, estoque) recebem valores neutros — inventá-los a partir do
 * catálogo atual seria mostrar o produto de hoje em um pedido de ontem.
 */
function toOrder(order: ApiOrder): Order {
  const items: CartItem[] = order.items.map((item) => ({
    product: {
      id: item.productId ?? item.productSlug,
      slug: item.productSlug,
      name: item.productName,
      brand: '',
      description: '',
      price: item.unitPrice,
      category: 'Áudio',
      rating: 0,
      reviewCount: 0,
      imageUrl: '',
      stock: 0,
    },
    quantity: item.quantity,
  }))

  const totals: CartTotals = {
    itemCount: order.itemCount,
    lineCount: order.items.length,
    subtotal: order.totals.subtotal,
    shipping: order.totals.shipping,
    total: order.totals.total,
  }

  return {
    id: order.id,
    createdAt: order.placedAt,
    customer: order.customer,
    address: { ...order.address, complement: order.address.complement ?? '' },
    items,
    totals,
  }
}

/**
 * Fecha o pedido.
 *
 * Repare no que NÃO é enviado: itens, preços e totais. Eles vêm do carrinho no servidor,
 * e o preço é lido do banco dentro da transação. Se o cliente mandasse a lista, mandaria
 * também os valores — e um pedido de R$ 0,01 seria aceito.
 *
 * A assinatura mantém `CreateOrderInput` inteiro por compatibilidade com a tela de
 * checkout; apenas `customer` e `address` atravessam a rede.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const order = await request<ApiOrder>('/orders', {
    method: 'POST',
    body: { customer: input.customer, address: input.address },
  })

  return toOrder(order)
}

/** Histórico do usuário autenticado. */
export async function getOrders(): Promise<Order[]> {
  const orders = await request<ApiOrder[]>('/orders')
  return orders.map(toOrder)
}

export async function getOrderById(orderId: string): Promise<Order> {
  return toOrder(await request<ApiOrder>(`/orders/${encodeURIComponent(orderId)}`))
}
