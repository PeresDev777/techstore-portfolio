import { expect, type Locator, type Page } from '@playwright/test'

import { ROUTES } from '@utils/routes'

/**
 * Componente de cabeçalho.
 *
 * O cabeçalho aparece em TODAS as telas autenticadas. Modelá-lo como página seria errado
 * — ele não tem URL própria. Como componente, é composto dentro dos page objects que o
 * contêm, seguindo a mesma estrutura da aplicação.
 */
export class HeaderComponent {
  private readonly page: Page
  readonly cartCount: Locator
  readonly userName: Locator

  constructor(page: Page) {
    this.page = page
    this.cartCount = page.getByTestId('header-cart-count')
    this.userName = page.getByTestId('header-username')
  }

  async goToProducts(): Promise<void> {
    await this.page.getByTestId('nav-products').click()
  }

  async goToDashboard(): Promise<void> {
    await this.page.getByTestId('nav-dashboard').click()
  }

  async goToCart(): Promise<void> {
    await this.page.getByTestId('header-cart').click()
  }

  async logout(): Promise<void> {
    await this.page.getByTestId('header-logout').click()
    // Só devolve o controle quando a saída de fato aconteceu.
    await expect(this.page).toHaveURL(new RegExp(ROUTES.login))
  }

  /** Quantidade total de itens no carrinho; `0` quando o badge não é exibido. */
  async cartItemCount(): Promise<number> {
    if ((await this.cartCount.count()) === 0) return 0
    return Number(await this.cartCount.textContent())
  }
}
