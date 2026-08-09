import { CUSTOMER, EXPECTED_MASKS } from '@data/customers'
import { PRODUCTS, SHIPPING } from '@data/products'
import { expect, test } from '@fixtures/test'
import { ROUTES } from '@utils/routes'

test.describe('Checkout — finalização', () => {
  test.beforeEach(async ({ productDetailPage }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
  })

  test('o resumo do checkout reflete o carrinho', async ({ productDetailPage, checkoutPage }) => {
    await productDetailPage.openProduct(PRODUCTS.headphone.id)
    await productDetailPage.addToCart()

    await checkoutPage.open()

    await expect(checkoutPage.summaryItems).toHaveCount(2)
    expect(await checkoutPage.summarySubtotalInCents()).toBe(
      PRODUCTS.mouse.price + PRODUCTS.headphone.price,
    )
    expect(await checkoutPage.summaryShippingInCents()).toBe(0)
  })

  test(
    'pedido concluído exibe confirmação com os dados informados',
    {
      tag: ['@smoke', '@critical'],
    },
    async ({ checkoutPage, orderSuccessPage }) => {
      await checkoutPage.open()
      await checkoutPage.placeOrder(CUSTOMER)

      await orderSuccessPage.waitUntilReady()
      await orderSuccessPage.expectOrderNumberFormat()
      await orderSuccessPage.expectOrderMatches(CUSTOMER, {
        cpf: EXPECTED_MASKS.cpf,
        phone: EXPECTED_MASKS.mobilePhone,
        zipCode: EXPECTED_MASKS.zipCode,
      })

      // Evidência do marco no relatório, mesmo com o teste verde.
      await orderSuccessPage.attachScreenshot('pedido-confirmado')
    },
  )

  test(
    'o total do pedido é o mesmo do carrinho',
    { tag: '@critical' },
    async ({ cartPage, checkoutPage, orderSuccessPage }) => {
      await cartPage.open()
      const cartTotal = await cartPage.totalInCents()

      await cartPage.goToCheckout()
      await checkoutPage.waitUntilReady()
      expect(await checkoutPage.summaryTotalInCents()).toBe(cartTotal)

      await checkoutPage.placeOrder(CUSTOMER)

      await orderSuccessPage.waitUntilReady()
      expect(await orderSuccessPage.totalInCents()).toBe(cartTotal)
      expect(cartTotal).toBe(PRODUCTS.mouse.price + SHIPPING.cost)
    },
  )

  test(
    'o carrinho é esvaziado após a compra',
    { tag: '@critical' },
    async ({ checkoutPage, orderSuccessPage }) => {
      await checkoutPage.open()
      await checkoutPage.placeOrder(CUSTOMER)

      await orderSuccessPage.waitUntilReady()
      await expect(orderSuccessPage.header.cartCount).toBeHidden()
    },
  )

  test('cada pedido recebe um número diferente', async ({
    checkoutPage,
    orderSuccessPage,
    productDetailPage,
  }) => {
    await checkoutPage.open()
    await checkoutPage.placeOrder(CUSTOMER)
    await orderSuccessPage.waitUntilReady()
    const firstOrderId = await orderSuccessPage.orderId()

    await productDetailPage.openProduct(PRODUCTS.headphone.id)
    await productDetailPage.addToCart()
    await checkoutPage.open()
    await checkoutPage.placeOrder(CUSTOMER)
    await orderSuccessPage.waitUntilReady()

    expect(await orderSuccessPage.orderId()).not.toBe(firstOrderId)
  })

  test('voltar após a compra não retorna ao formulário', async ({
    checkoutPage,
    orderSuccessPage,
    page,
  }) => {
    /*
     * O checkout navega com `replace`. Sem isso, o "voltar" devolveria o usuário a um
     * formulário de um pedido já finalizado — e um segundo envio criaria pedido duplicado.
     */
    await checkoutPage.open()
    await checkoutPage.placeOrder(CUSTOMER)
    await orderSuccessPage.waitUntilReady()

    await page.goBack()

    await expect(page).not.toHaveURL(new RegExp(ROUTES.checkout))
  })
})

test.describe('Página de sucesso', () => {
  test('acesso direto sem pedido redireciona', async ({ productsPage, page }) => {
    // Não pode existir confirmação de compra sem compra.
    await page.goto(ROUTES.orderSuccess)

    await productsPage.expectToBeCurrentPage()
  })
})
