import { CUSTOMER, EXPECTED_MASKS } from '@data/customers'
import { PRODUCTS, SEARCH_TERMS, SHIPPING } from '@data/products'
import { USERS } from '@data/users'
import { expect, test } from '@fixtures/anonymous'
import { ProductDetailPage } from '@pages/ProductDetailPage'

/**
 * Jornada completa do cliente.
 *
 * Diferente dos specs por feature, este teste NÃO isola nada: parte deslogado e percorre
 * o caminho real de uma compra. É o cenário que prova que as partes funcionam juntas —
 * cada feature pode estar verde isoladamente e a integração ainda quebrar.
 *
 * Por ser caro e amplo, existe UM. Cobertura de casos de borda pertence aos specs de
 * feature, que são rápidos e apontam a causa com precisão quando falham.
 */
test(
  'login → pesquisa → carrinho → checkout → compra concluída',
  {
    tag: ['@smoke', '@critical'],
  },
  async ({
    loginPage,
    dashboardPage,
    productsPage,
    productDetailPage,
    cartPage,
    checkoutPage,
    orderSuccessPage,
  }) => {
    await test.step('autentica na loja', async () => {
      await loginPage.open()
      await loginPage.loginAs(USERS.valid)

      await expect(dashboardPage.greeting).toContainText(USERS.valid.name)
      await expect(dashboardPage.header.cartCount).toBeHidden()
    })

    await test.step('pesquisa o produto desejado', async () => {
      await dashboardPage.header.goToProducts()
      await productsPage.waitForResults()

      await productsPage.search(SEARCH_TERMS.single.term)
      await expect(productsPage.cards).toHaveCount(SEARCH_TERMS.single.expectedCount)
    })

    await test.step('abre o produto e confere os dados', async () => {
      await productsPage.openProduct(PRODUCTS.keyboard.name)

      await productDetailPage.waitUntilReady()
      expect(await productDetailPage.displayedProduct()).toMatchObject(
        ProductDetailPage.expected(PRODUCTS.keyboard),
      )
      await productDetailPage.expectImageLoaded()
    })

    await test.step('adiciona ao carrinho', async () => {
      await productDetailPage.addToCart()

      await expect(productDetailPage.header.cartCount).toHaveText('1')
    })

    await test.step('confere o carrinho', async () => {
      await productDetailPage.header.goToCart()
      await cartPage.waitUntilReady()

      await expect(cartPage.items).toHaveCount(1)
      expect(await cartPage.subtotalInCents()).toBe(PRODUCTS.keyboard.price)
      expect(await cartPage.shippingInCents()).toBe(0) // acima do limite de frete grátis
      expect(await cartPage.totalInCents()).toBe(PRODUCTS.keyboard.price)
      await cartPage.expectTotalsAreConsistent()
    })

    await test.step('preenche o checkout', async () => {
      await cartPage.goToCheckout()
      await checkoutPage.waitUntilReady()

      expect(await checkoutPage.summaryTotalInCents()).toBe(PRODUCTS.keyboard.price)
      await checkoutPage.placeOrder(CUSTOMER)
    })

    await test.step('confirma a compra', async () => {
      await orderSuccessPage.waitUntilReady()

      await orderSuccessPage.expectOrderNumberFormat()
      await orderSuccessPage.expectOrderMatches(CUSTOMER, {
        cpf: EXPECTED_MASKS.cpf,
        phone: EXPECTED_MASKS.mobilePhone,
        zipCode: EXPECTED_MASKS.zipCode,
      })
      expect(await orderSuccessPage.totalInCents()).toBe(PRODUCTS.keyboard.price)

      // Carrinho zerado é a prova de que o pedido foi de fato consumido.
      await expect(orderSuccessPage.header.cartCount).toBeHidden()

      await orderSuccessPage.attachScreenshot('compra-concluida')
    })

    await test.step('segue comprando com o carrinho limpo', async () => {
      await orderSuccessPage.continueShopping()

      await productsPage.waitForResults()
      await expect(productsPage.header.cartCount).toBeHidden()
    })

    // Frete grátis foi aplicado porque o teclado custa acima do limite.
    expect(PRODUCTS.keyboard.price).toBeGreaterThan(SHIPPING.freeFrom)
  },
)
