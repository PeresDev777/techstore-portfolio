import { PRODUCTS, SHIPPING } from '@data/products'
import { USERS } from '@data/users'
import { expect, test } from '@fixtures/test'

test.describe('Carrinho', () => {
  test('adicionar pela listagem não abre o detalhe do produto', async ({ productsPage, page }) => {
    await productsPage.open()
    await productsPage.waitForResults()

    await productsPage.addToCart(PRODUCTS.mouse.name)

    await productsPage.header.expectCartCount(1)
    await expect(page).toHaveURL(/\/products$/)
  })

  test(
    'adicionar pela página do produto com quantidade escolhida',
    { tag: '@smoke' },
    async ({ productDetailPage }) => {
      await productDetailPage.openProduct(PRODUCTS.mouse.id)

      await productDetailPage.addToCartWithQuantity(3)

      await productDetailPage.header.expectCartCount(3)
    },
  )

  test('o badge só aparece quando há itens', async ({ productDetailPage }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.header.expectCartCount(0)

    await productDetailPage.addToCart()

    await productDetailPage.header.expectCartCount(1)
  })

  test(
    'total do carrinho é subtotal mais frete',
    { tag: ['@smoke', '@critical'] },
    async ({ productDetailPage, cartPage }) => {
      await productDetailPage.openProduct(PRODUCTS.mouse.id)
      await productDetailPage.addToCart()
      await cartPage.open()

      expect(await cartPage.subtotalInCents()).toBe(PRODUCTS.mouse.price)
      expect(await cartPage.shippingInCents()).toBe(SHIPPING.cost)
      await cartPage.expectTotalsAreConsistent()
    },
  )

  test('frete fica gratuito acima do limite', async ({ productDetailPage, cartPage }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCartWithQuantity(2)
    await cartPage.open()

    expect(await cartPage.subtotalInCents()).toBeGreaterThanOrEqual(SHIPPING.freeFrom)
    expect(await cartPage.shippingInCents()).toBe(0)
    await expect(cartPage.shipping).toHaveText('Grátis')
  })

  test('alterar a quantidade recalcula linha, subtotal e badge', async ({
    productDetailPage,
    cartPage,
  }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await cartPage.open()

    await cartPage.increaseQuantity(PRODUCTS.mouse.id)

    expect(await cartPage.quantityOf(PRODUCTS.mouse.id)).toBe(2)
    expect(await cartPage.lineTotalOf(PRODUCTS.mouse.id)).toBe(PRODUCTS.mouse.price * 2)
    await cartPage.expectSubtotalMatchesLines()
    await cartPage.header.expectCartCount(2)
  })

  test('não é possível reduzir abaixo de uma unidade', async ({
    productDetailPage,
    cartPage,
    page,
  }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await cartPage.open()

    await expect(
      page.locator(`[data-testid="cart-item"] [data-testid="quantity-decrease"]`),
    ).toBeDisabled()
  })

  test(
    'a quantidade não passa do estoque disponível',
    { tag: '@critical' },
    async ({ productDetailPage, cartPage }) => {
      await productDetailPage.openProduct(PRODUCTS.premiumLaptop.id)
      await productDetailPage.addToCartWithQuantity(PRODUCTS.premiumLaptop.stock)

      // Já no estoque máximo, o botão de adicionar fica indisponível.
      await productDetailPage.expectAddButtonDisabled()

      await cartPage.open()
      expect(await cartPage.quantityOf(PRODUCTS.premiumLaptop.id)).toBe(
        PRODUCTS.premiumLaptop.stock,
      )
    },
  )

  test('remover um item devolve o carrinho ao estado vazio', async ({
    productDetailPage,
    cartPage,
  }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await cartPage.open()

    await cartPage.removeItem(PRODUCTS.mouse.id)

    await cartPage.expectEmpty()
    await cartPage.header.expectCartCount(0)
  })

  test('esvaziar remove todos os produtos de uma vez', async ({ productDetailPage, cartPage }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await productDetailPage.openProduct(PRODUCTS.headphone.id)
    await productDetailPage.addToCart()

    await cartPage.open()
    await cartPage.expectLineCount(2)

    await cartPage.clearCart()

    await cartPage.expectEmpty()
  })

  test('produtos diferentes somam corretamente', async ({ productDetailPage, cartPage }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await productDetailPage.openProduct(PRODUCTS.headphone.id)
    await productDetailPage.addToCart()

    await cartPage.open()

    expect(await cartPage.subtotalInCents()).toBe(PRODUCTS.mouse.price + PRODUCTS.headphone.price)
    await cartPage.expectSubtotalMatchesLines()
    await cartPage.expectTotalsAreConsistent()
  })

  test('o carrinho persiste ao recarregar a página', async ({
    productDetailPage,
    cartPage,
    page,
  }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()

    await cartPage.open()
    await cartPage.expectLineCount(1)

    await page.reload()

    await cartPage.waitUntilReady()
    await cartPage.expectLineCount(1)
  })

  test('carrinho vazio oferece caminho de volta ao catálogo', async ({
    cartPage,
    productsPage,
  }) => {
    await cartPage.open()

    await cartPage.expectEmpty()
    await cartPage.goToProductsFromEmptyState()

    await productsPage.waitUntilReady()
  })

  test('o carrinho é isolado por usuário', async ({
    productDetailPage,
    loginPage,
    dashboardPage,
  }) => {
    /*
     * Cenário de computador compartilhado: o carrinho de um usuário jamais pode aparecer
     * para outro. A chave de persistência inclui o id do usuário.
     */
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await productDetailPage.header.expectCartCount(1)

    await productDetailPage.header.logout()
    await loginPage.loginAs(USERS.secondary)

    await dashboardPage.header.expectCartCount(0)

    // E o carrinho do primeiro usuário continua intacto quando ele volta.
    await dashboardPage.header.logout()
    await loginPage.loginAs(USERS.valid)

    await dashboardPage.header.expectCartCount(1)
  })
})
