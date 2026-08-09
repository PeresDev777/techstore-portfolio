import { CATALOG_SIZE, PRODUCTS, PRODUCTS_BY_CATEGORY, SORT } from '@data/products'
import { expect, test } from '@fixtures/test'
import { PRODUCT_PARAMS } from '@utils/routes'

test.describe('Listagem de produtos', () => {
  test.beforeEach(async ({ productsPage }) => {
    await productsPage.open()
    await productsPage.waitForResults()
  })

  test('exibe o catálogo completo', { tag: '@smoke' }, async ({ productsPage }) => {
    await expect(productsPage.cards).toHaveCount(CATALOG_SIZE)
    await expect(productsPage.resultCount).toHaveText(`${CATALOG_SIZE} produtos encontrados`)
  })

  test('filtra por categoria', async ({ productsPage }) => {
    await productsPage.filterByCategory(PRODUCTS.premiumLaptop.category)

    await expect(productsPage.cards).toHaveCount(PRODUCTS_BY_CATEGORY.Notebooks)
  })

  test('filtro de estoque remove os produtos esgotados', async ({ productsPage }) => {
    await productsPage.filterByCategory('Monitores')
    await expect(productsPage.cards).toHaveCount(PRODUCTS_BY_CATEGORY.Monitores)

    await productsPage.toggleInStockOnly()

    // Um dos dois monitores está esgotado na massa de dados.
    await expect(productsPage.cards).toHaveCount(PRODUCTS_BY_CATEGORY.Monitores - 1)
  })

  test('ordena por menor preço', async ({ productsPage }) => {
    await productsPage.sortBy(SORT.priceAsc)

    const prices = await productsPage.visiblePrices()

    /*
     * Asseverar o TAMANHO primeiro. `toEqual([...prices].sort())` passa trivialmente para
     * uma lista vazia — foi por isso que a leitura de uma grade em transicao chegou ate a
     * assercao seguinte em vez de falhar aqui, com uma mensagem que nao explicava nada.
     */
    expect(prices).toHaveLength(CATALOG_SIZE)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(prices[0]).toBe(PRODUCTS.mouse.price)
  })

  test('ordena por maior preço', async ({ productsPage }) => {
    await productsPage.sortBy(SORT.priceDesc)

    const prices = await productsPage.visiblePrices()

    /*
     * Asseverar o TAMANHO primeiro. `toEqual([...prices].sort())` passa trivialmente para
     * uma lista vazia — foi por isso que a leitura de uma grade em transicao chegou ate a
     * assercao seguinte em vez de falhar aqui, com uma mensagem que nao explicava nada.
     */
    expect(prices).toHaveLength(CATALOG_SIZE)
    expect(prices).toEqual([...prices].sort((a, b) => b - a))
    expect(prices[0]).toBe(PRODUCTS.premiumLaptop.price)
  })

  test('ordena por nome', async ({ productsPage }) => {
    await productsPage.sortBy(SORT.nameAsc)

    const names = await productsPage.visibleNames()

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  test('limpar filtros restaura o catálogo completo', async ({ productsPage }) => {
    await productsPage.filterByCategory('Monitores')
    await productsPage.toggleInStockOnly()

    await productsPage.clearFilters()

    await expect(productsPage.cards).toHaveCount(CATALOG_SIZE)
  })

  test('produto esgotado exibe o selo na grade', async ({ productsPage }) => {
    await expect(productsPage.outOfStockBadgeFor(PRODUCTS.outOfStock.name)).toBeVisible()
  })
})

test.describe('Filtros na URL', () => {
  /*
   * Os filtros vivem na query string. Isso permite abrir a listagem já em um estado
   * complexo sem clicar em nada — mais rápido e mais estável — e garante que a busca seja
   * um link compartilhável.
   */
  test('abre a listagem já filtrada por categoria', async ({ productsPage }) => {
    await productsPage.openWith({ [PRODUCT_PARAMS.category]: 'Wearables' })

    await expect(productsPage.cards).toHaveCount(PRODUCTS_BY_CATEGORY.Wearables)
  })

  test('estado dos filtros sobrevive ao recarregar', async ({ productsPage, page }) => {
    await productsPage.openWith({
      [PRODUCT_PARAMS.category]: 'Wearables',
      [PRODUCT_PARAMS.sort]: SORT.priceAsc,
    })
    await expect(productsPage.cards).toHaveCount(PRODUCTS_BY_CATEGORY.Wearables)

    await page.reload()
    await productsPage.waitForResults()

    await expect(productsPage.cards).toHaveCount(PRODUCTS_BY_CATEGORY.Wearables)
    await expect(productsPage.categoryFilter).toHaveValue('Wearables')
  })

  test('parâmetro inválido cai no padrão em vez de quebrar', async ({ productsPage }) => {
    // A URL é entrada não confiável: qualquer pessoa pode digitar qualquer coisa.
    await productsPage.openWith({ [PRODUCT_PARAMS.sort]: 'ordenacao-inexistente' })

    await expect(productsPage.cards).toHaveCount(CATALOG_SIZE)
  })

  test('atalho de categoria do dashboard leva à listagem filtrada', async ({
    dashboardPage,
    productsPage,
  }) => {
    await dashboardPage.open()
    await dashboardPage.openCategory('Notebooks')

    await productsPage.waitForResults()
    await expect(productsPage.cards).toHaveCount(PRODUCTS_BY_CATEGORY.Notebooks)
  })
})
