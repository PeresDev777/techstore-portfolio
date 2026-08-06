import { Injectable } from '@nestjs/common'
import { insufficientStock, notFound } from '../../common/exceptions/domain.exceptions'
import { ProductEntity } from '../products/entities/product.entity'
import { ProductsRepository } from '../products/products.repository'
import { calculateTotals, type TotalizableItem } from './cart-totals'
import { CartRepository, type CartItemWithProduct, type CartWithItems } from './cart.repository'
import type { AddCartItemDto } from './dto/add-cart-item.dto'
import type { UpdateCartItemDto } from './dto/update-cart-item.dto'
import { CartEntity, CartItemEntity } from './entities/cart.entity'

@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductsRepository,
  ) {}

  /**
   * Leitura do carrinho. NAO cria nada.
   *
   * Um GET que escreve no banco e um GET que deixou de ser seguro: prefetch do navegador,
   * varredura de robo e health check passariam a criar carrinhos vazios. Quem nunca
   * adicionou nada recebe um carrinho vazio calculado em memoria.
   */
  async findByUser(userId: string): Promise<CartEntity> {
    const cart = await this.carts.findByUserId(userId)

    return cart ? this.toEntity(cart) : this.emptyCart()
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartEntity> {
    const product = await this.getPurchasableProduct(dto.productId)
    const cart = await this.carts.ensureForUser(userId)

    const existing = await this.carts.findItem(cart.id, product.id)
    const currentQuantity = existing?.quantity ?? 0
    const requested = currentQuantity + dto.quantity

    /*
     * O limite de estoque se aplica a SOMA, nao a parcela.
     *
     * Adicionar 3 a um item que ja tem 2, com estoque 4, precisa considerar 5 — e nao
     * apenas os 3 que chegaram na requisicao. Validar so o incremento permitiria estourar
     * o estoque em duas chamadas de 3 unidades cada.
     */
    this.assertStock(product, requested, currentQuantity)

    await this.carts.setItemQuantity(cart.id, product.id, requested)

    return this.findByUser(userId)
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto): Promise<CartEntity> {
    const cart = await this.requireCart(userId)
    const product = await this.getPurchasableProduct(productId)

    const existing = await this.carts.findItem(cart.id, product.id)

    if (!existing) {
      throw notFound('Este produto não está no carrinho.')
    }

    // Aqui a quantidade e ABSOLUTA: substitui, nao soma. Por isso nao ha `currentQuantity`.
    this.assertStock(product, dto.quantity, 0)

    await this.carts.setItemQuantity(cart.id, product.id, dto.quantity)

    return this.findByUser(userId)
  }

  async removeItem(userId: string, productId: string): Promise<CartEntity> {
    const cart = await this.requireCart(userId)

    /*
     * Resolve por id OU slug, como o resto da API — mas sem exigir que o produto esteja
     * ATIVO. Um produto retirado de catalogo continua no carrinho de quem o adicionou
     * antes, e essa pessoa precisa conseguir tira-lo de la.
     */
    const product = await this.products.findByIdOrSlug(productId, false)

    if (!product) {
      throw notFound('Produto não encontrado.')
    }

    const existing = await this.carts.findItem(cart.id, product.id)

    if (!existing) {
      throw notFound('Este produto não está no carrinho.')
    }

    await this.carts.removeItem(cart.id, product.id)

    return this.findByUser(userId)
  }

  async clear(userId: string): Promise<CartEntity> {
    const cart = await this.carts.findByUserId(userId)

    // Esvaziar um carrinho que nao existe ja produz o estado desejado. Um 404 aqui
    // obrigaria o cliente a tratar como erro uma operacao que atingiu o seu objetivo.
    if (cart) await this.carts.clear(cart.id)

    return this.emptyCart()
  }

  // -------------------------------------------------------------------------

  private async requireCart(userId: string): Promise<CartWithItems> {
    const cart = await this.carts.findByUserId(userId)

    if (!cart) {
      throw notFound('Carrinho vazio.')
    }

    return cart
  }

  private async getPurchasableProduct(identifier: string) {
    // `onlyActive` implicito: produto fora de catalogo nao entra no carrinho.
    const product = await this.products.findByIdOrSlug(identifier)

    if (!product) {
      throw notFound('Produto não encontrado.')
    }

    return product
  }

  /**
   * Estoque insuficiente responde 409 — nao ajusta a quantidade em silencio.
   *
   * O redutor do frontend faz o oposto (`clampToStock`), e esta certo para a camada dele:
   * o seletor de quantidade da UI ja impede pedir mais que o disponivel, e o clamp e a
   * rede de conveniencia.
   *
   * Uma API que recebe "quero 5" e grava 3 sem avisar entrega ao cliente um estado
   * diferente do que ele pediu, e o proximo passo do fluxo age sobre uma premissa falsa.
   * A resposta diz o que ha e o que ja esta reservado, para o cliente decidir.
   */
  private assertStock(
    product: { id: string; name: string; stock: number },
    requested: number,
    alreadyInCart: number,
  ): void {
    if (product.stock === 0) {
      throw insufficientStock(`"${product.name}" está esgotado.`, [
        { field: 'productId', message: 'Produto sem estoque.' },
      ])
    }

    if (requested > product.stock) {
      const detail =
        alreadyInCart > 0
          ? `Estoque disponível: ${product.stock} (${alreadyInCart} já no carrinho).`
          : `Estoque disponível: ${product.stock}.`

      throw insufficientStock(`Quantidade indisponível para "${product.name}". ${detail}`, [
        { field: 'quantity', message: detail },
      ])
    }
  }

  private emptyCart(): CartEntity {
    return { items: [], totals: calculateTotals([]) }
  }

  private toEntity(cart: CartWithItems): CartEntity {
    const items = cart.items.map((item) => this.toItemEntity(item))

    /*
     * Apenas os itens COMPRAVEIS entram nos totais.
     *
     * Somar um produto esgotado produziria um total que o checkout jamais cobraria — o
     * usuario veria um valor na tela do carrinho e outro na finalizacao, sem entender por
     * que. O item continua visivel, marcado como indisponivel.
     */
    const totalizable: TotalizableItem[] = items
      .filter((item) => !item.unavailable)
      .map((item) => ({ priceInCents: item.product.price, quantity: item.quantity }))

    return { items, totals: calculateTotals(totalizable) }
  }

  private toItemEntity(item: CartItemWithProduct): CartItemEntity {
    const entity = new CartItemEntity()

    entity.id = item.id
    entity.product = ProductEntity.from(item.product)
    entity.quantity = item.quantity
    entity.lineTotal = item.product.priceInCents * item.quantity
    entity.unavailable = false

    if (!item.product.isActive) {
      entity.unavailable = true
      entity.unavailableReason = 'Produto fora de catálogo.'
    } else if (item.product.stock === 0) {
      entity.unavailable = true
      entity.unavailableReason = 'Produto esgotado.'
    } else if (item.product.stock < item.quantity) {
      entity.unavailable = true
      entity.unavailableReason = `Estoque disponível: ${item.product.stock}.`
    }

    return entity
  }
}
