import { USERS } from '@data/users'
import { expect, test } from '@fixtures/anonymous'
import { ROUTES } from '@utils/routes'

test.describe('Rotas protegidas', () => {
  const PROTECTED_ROUTES = [
    ROUTES.dashboard,
    ROUTES.products,
    ROUTES.cart,
    ROUTES.checkout,
  ] as const

  for (const route of PROTECTED_ROUTES) {
    test(`acesso a ${route} sem sessão redireciona para o login`, async ({ page }) => {
      await page.goto(route)

      await expect(page).toHaveURL(new RegExp(ROUTES.login))
    })
  }

  test('após o login, o usuário volta para a rota que tentou abrir', async ({
    loginPage,
    cartPage,
    page,
  }) => {
    // Deep link: quem clica em um link de carrinho sem estar logado não deve perder o destino.
    await page.goto(ROUTES.cart)
    await expect(page).toHaveURL(new RegExp(ROUTES.login))

    await loginPage.loginAs(USERS.valid)

    await cartPage.expectToBeCurrentPage()
  })

  test('logout não deixa a rota anterior para o próximo usuário', async ({
    loginPage,
    dashboardPage,
    productsPage,
    page,
  }) => {
    /*
     * Regressão de um bug real: o logout gravava a última rota do usuário que saiu, e o
     * PRÓXIMO a entrar naquele navegador aterrissava nela — vazamento de contexto entre
     * contas em um computador compartilhado.
     */
    await loginPage.open()
    await loginPage.loginAs(USERS.valid)

    await productsPage.open()
    await productsPage.header.logout()

    await loginPage.loginAs(USERS.secondary)

    await dashboardPage.expectToBeCurrentPage()
    await expect(page).not.toHaveURL(new RegExp(ROUTES.products))
  })
})
