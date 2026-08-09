import { expect, type Locator } from '@playwright/test'

import { BasePage } from '@pages/BasePage'
import { HeaderComponent } from '@pages/components/HeaderComponent'
import { ROUTES } from '@utils/routes'
import { readCents } from '@utils/money'

export class CartPage extends BasePage {
  protected readonly path = ROUTES.cart
  protected readonly readyLocator: Locator = this.byTestId('cart-page')

  readonly header = new HeaderComponent(this.page)

  readonly items: Locator = this.byTestId('cart-item')
  readonly emptyState: Locator = this.byTestId('cart-empty')
  readonly subtotal: Locator = this.byTestId('cart-subtotal')
  readonly shipping: Locator = this.byTestId('cart-shipping')
  readonly total: Locator = this.byTestId('cart-total')

  /**
   * Linha de um produto específico.
   *
   * Localiza por `data-product-id`, não por texto: nomes de produto podem se conter
   * mutuamente ("Fone" casa com dois itens do catálogo), enquanto o id é o identificador
   * estável do domínio.
   */
  private itemRow(productId: string): Locator {
    return this.page.locator(`[data-testid="cart-item"][data-product-id="${productId}"]`)
  }

  async increaseQuantity(productId: string): Promise<void> {
    await this.mutatingCart(() => this.itemRow(productId).getByTestId('quantity-increase').click())
  }

  async decreaseQuantity(productId: string): Promise<void> {
    await this.mutatingCart(() => this.itemRow(productId).getByTestId('quantity-decrease').click())
  }

  async quantityOf(productId: string): Promise<number> {
    return Number(await this.itemRow(productId).getByTestId('quantity-value').textContent())
  }

  async lineTotalOf(productId: string): Promise<number> {
    return readCents(this.itemRow(productId).getByTestId('cart-item-total'))
  }

  async removeItem(productId: string): Promise<void> {
    await this.mutatingCart(() => this.itemRow(productId).getByTestId('cart-item-remove').click())
  }

  async clearCart(): Promise<void> {
    await this.mutatingCart(() => this.byTestId('cart-clear').click())
  }

  async goToCheckout(): Promise<void> {
    await this.byTestId('cart-checkout').click()
  }

  async continueShopping(): Promise<void> {
    await this.byTestId('cart-continue-shopping').click()
  }

  async subtotalInCents(): Promise<number> {
    return readCents(this.subtotal)
  }

  async shippingInCents(): Promise<number> {
    return readCents(this.shipping)
  }

  async totalInCents(): Promise<number> {
    return readCents(this.total)
  }

  /**
   * Confere a identidade contábil do carrinho: total = subtotal + frete.
   *
   * Independente dos valores concretos, essa relação tem que valer sempre — uma asserção
   * que continua correta mesmo se a massa de teste mudar.
   */
  async expectTotalsAreConsistent(): Promise<void> {
    const [subtotal, shipping, total] = await Promise.all([
      this.subtotalInCents(),
      this.shippingInCents(),
      this.totalInCents(),
    ])

    expect(total, 'total deve ser subtotal + frete').toBe(subtotal + shipping)
  }

  /** Soma dos totais de linha deve bater com o subtotal exibido. */
  async expectSubtotalMatchesLines(): Promise<void> {
    const lineTotals = await this.byTestId('cart-item-total').evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('data-price-cents'))),
    )

    const sum = lineTotals.reduce((total, value) => total + value, 0)
    expect(await this.subtotalInCents()).toBe(sum)
  }

  async isEmptyCtaVisible(): Promise<boolean> {
    return this.byTestId('cart-empty-cta').isVisible()
  }

  async goToProductsFromEmptyState(): Promise<void> {
    await this.byTestId('cart-empty-cta').click()
  }
}
