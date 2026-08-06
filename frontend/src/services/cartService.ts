import { request } from '@/services/http'
import type { CartItem, CartTotals } from '@/types/cart'
import type { Product } from '@/types/product'

/**
 * Serviço de carrinho.
 *
 * O carrinho passou a viver no SERVIDOR. Antes era um estado local persistido em
 * `localStorage` por usuário (ADR-011/012); agora a API é a fonte da verdade e o
 * `CartProvider` mantém apenas um cache otimista.
 *
 * O ganho concreto: o carrinho segue o usuário entre dispositivos, e o estoque é
 * verificado por quem realmente sabe o saldo. O custo: cada operação é uma requisição, e
 * a UI precisa lidar com a janela entre a ação e a confirmação — resolvida no provider
 * aplicando a mudança localmente antes de enviar.
 */

/** Item como a API devolve — traz o snapshot do produto e sinaliza indisponibilidade. */
interface ApiCartItem {
  id: string
  product: Product
  quantity: number
  lineTotal: number
  unavailable: boolean
  unavailableReason?: string
}

interface ApiCart {
  items: ApiCartItem[]
  totals: CartTotals
}

export interface CartSnapshot {
  items: CartItem[]
  totals: CartTotals
}

/**
 * Converte a resposta para a forma que a aplicação já usa.
 *
 * `CartItem` continua sendo `{ product, quantity }` — a mesma estrutura do redutor. Foi o
 * que permitiu manter componentes, redutor e testes unitários intactos: mudou de onde os
 * itens vêm, não o que eles são.
 */
function toSnapshot(cart: ApiCart): CartSnapshot {
  return {
    items: cart.items.map((item) => ({ product: item.product, quantity: item.quantity })),
    totals: cart.totals,
  }
}

export async function getCart(): Promise<CartSnapshot> {
  return toSnapshot(await request<ApiCart>('/cart'))
}

/**
 * Adiciona um produto. Quantidade é INCREMENTO: a API soma ao que já existe e aplica o
 * limite de estoque sobre a soma.
 */
export async function addItem(productId: string, quantity: number): Promise<CartSnapshot> {
  return toSnapshot(
    await request<ApiCart>('/cart/items', {
      method: 'POST',
      body: { productId, quantity },
    }),
  )
}

/**
 * Define a quantidade de um item. Valor ABSOLUTO, não incremento.
 *
 * Quantidade zero vira REMOÇÃO. A API recusa `quantity: 0` no PATCH de propósito — existe
 * um DELETE para isso, e um "update que apaga" seria um verbo mentiroso. A UI, porém,
 * decrementa até zero em um gesto só (`QuantityStepper`), então a tradução acontece aqui:
 * a tela mantém a interação natural e a API mantém a semântica correta.
 */
export async function updateQuantity(productId: string, quantity: number): Promise<CartSnapshot> {
  if (quantity <= 0) return removeItem(productId)

  return toSnapshot(
    await request<ApiCart>(`/cart/items/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: { quantity },
    }),
  )
}

export async function removeItem(productId: string): Promise<CartSnapshot> {
  return toSnapshot(
    await request<ApiCart>(`/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
  )
}

export async function clearCart(): Promise<CartSnapshot> {
  return toSnapshot(await request<ApiCart>('/cart', { method: 'DELETE' }))
}
