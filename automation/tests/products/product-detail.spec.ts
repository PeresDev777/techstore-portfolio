import { PRODUCTS } from '@data/products'
import { expect, test } from '@fixtures/test'

test.describe('Página do produto', () => {
  test('exibe nome, preço, categoria, descrição e avaliação', async ({ productDetailPage }) => {
    await productDetailPage.openProduct(PRODUCTS.headphone.id)

    await productDetailPage.expectProductDetails(PRODUCTS.headphone)
    await expect(productDetailPage.description).toContainText('cancelamento ativo')
  })

  test('a imagem do produto realmente carrega', async ({ productDetailPage }) => {
    await productDetailPage.openProduct(PRODUCTS.headphone.id)

    // Verifica `naturalWidth`, não apenas visibilidade: um src quebrado passaria em toBeVisible.
    await productDetailPage.expectImageLoaded()
  })

  test('abrir pelo card da listagem leva ao produto certo', async ({
    productsPage,
    productDetailPage,
  }) => {
    await productsPage.open()
    await productsPage.waitForResults()

    await productsPage.openProduct(PRODUCTS.mouse.name)

    await productDetailPage.waitUntilReady()
    await productDetailPage.expectProductDetails(PRODUCTS.mouse)
  })

  test('produto inexistente exibe erro em vez de tela vazia', async ({ productDetailPage }) => {
    await productDetailPage.openMissingProduct('prd-999')

    await expect(productDetailPage.errorMessage).toContainText('não encontrado')
  })

  test('produto esgotado não pode ser comprado', async ({ productDetailPage }) => {
    await productDetailPage.openProduct(PRODUCTS.outOfStock.id)

    await productDetailPage.expectOutOfStock()
    await productDetailPage.expectAddButtonHidden()
  })

  test('exibe produtos relacionados da mesma categoria', async ({ productDetailPage }) => {
    await productDetailPage.openProduct(PRODUCTS.headphone.id)

    expect(await productDetailPage.relatedProductCount()).toBeGreaterThan(0)
  })

  test('o seletor de quantidade respeita o estoque', async ({ productDetailPage }) => {
    // Notebook Vertex Pro 16 tem estoque 3.
    await productDetailPage.openProduct(PRODUCTS.premiumLaptop.id)

    await productDetailPage.increaseQuantity(PRODUCTS.premiumLaptop.stock - 1)

    expect(await productDetailPage.selectedQuantity()).toBe(PRODUCTS.premiumLaptop.stock)
    await productDetailPage.expectIncreaseDisabled()
  })
})
