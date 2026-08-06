import { test as base } from '@playwright/test'

import { resetDatabase } from '@utils/api'

import { CartPage } from '@pages/CartPage'
import { CheckoutPage } from '@pages/CheckoutPage'
import { DashboardPage } from '@pages/DashboardPage'
import { LoginPage } from '@pages/LoginPage'
import { OrderSuccessPage } from '@pages/OrderSuccessPage'
import { ProductDetailPage } from '@pages/ProductDetailPage'
import { ProductsPage } from '@pages/ProductsPage'

/**
 * Page Objects entregues por injeção de dependência.
 *
 * Sem fixtures, todo spec começaria com um bloco de `new XPage(page)` — ruído repetido
 * que não descreve o cenário. Com elas, o spec declara o que precisa na assinatura do
 * teste e o Playwright instancia sob demanda: um page object não listado nunca é criado.
 */
/**
 * Estado do servidor, reiniciado antes de CADA teste.
 *
 * `auto: true` faz a fixture rodar sem que o spec a declare — e aqui isso e proposital.
 * Um teste que esquecesse de pedir o reset falharia de forma intermitente, dependendo da
 * ordem de execucao: o pior tipo de falha, porque parece flakiness e nao e.
 *
 * Antes da API, o isolamento era de graca — cada teste ganhava um contexto de navegador
 * novo e, com ele, um localStorage vazio. Com carrinho e pedidos no servidor, o
 * isolamento passou a ser trabalho explicito. E o preco de testar o sistema de verdade.
 */
interface ServerState {
  freshDatabase: void
}

interface Pages {
  loginPage: LoginPage
  dashboardPage: DashboardPage
  productsPage: ProductsPage
  productDetailPage: ProductDetailPage
  cartPage: CartPage
  checkoutPage: CheckoutPage
  orderSuccessPage: OrderSuccessPage
}

export const test = base.extend<Pages & ServerState>({
  freshDatabase: [
    async ({ request }, use) => {
      await resetDatabase(request)
      await use()
    },
    { auto: true },
  ],

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page))
  },

  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page))
  },

  productDetailPage: async ({ page }, use) => {
    await use(new ProductDetailPage(page))
  },

  cartPage: async ({ page }, use) => {
    await use(new CartPage(page))
  },

  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page))
  },

  orderSuccessPage: async ({ page }, use) => {
    await use(new OrderSuccessPage(page))
  },
})

/** Reexportado para que os specs importem tudo de um único módulo. */
export { expect } from '@playwright/test'
