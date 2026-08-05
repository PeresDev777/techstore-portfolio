import { API_ERROR_CODE, ApiError } from '@/services/apiError'
import { delay } from '@/services/http'
import type { CreateOrderInput, Order } from '@/types/order'

/**
 * Serviço de pedidos.
 *
 * Em um backend real, é aqui que o estoque seria reservado e o pagamento autorizado.
 * O mock mantém a mesma fronteira: recebe o pedido, valida o mínimo e devolve um pedido
 * com número — a UI não muda quando a API real entrar.
 */

/** Número curto e legível, fácil de ditar por telefone. */
function createOrderId(): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `TS-${random}`
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  await delay(700)

  /*
   * Revalidação no "servidor".
   *
   * A UI já impede finalizar um carrinho vazio, mas o serviço não confia na UI: em uma
   * aplicação real a requisição pode vir de qualquer lugar. Validar dos dois lados é o
   * padrão — a validação do cliente é conveniência, a do servidor é a que vale.
   */
  if (input.items.length === 0) {
    throw new ApiError(API_ERROR_CODE.NOT_FOUND, 'Não há itens no pedido.')
  }

  return {
    id: createOrderId(),
    createdAt: new Date().toISOString(),
    customer: input.customer,
    address: input.address,
    items: input.items,
    totals: input.totals,
  }
}
