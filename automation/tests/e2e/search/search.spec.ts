import { CATALOG_SIZE, SEARCH_TERMS } from '@data/products'
import { expect, test } from '@fixtures/test'
import { PRODUCT_PARAMS } from '@utils/routes'

test.describe('Pesquisa de produtos', () => {
  test.beforeEach(async ({ productsPage }) => {
    await productsPage.open()
    await productsPage.waitForResults()
  })

  test('encontra um produto existente', { tag: '@smoke' }, async ({ productsPage }) => {
    await productsPage.search(SEARCH_TERMS.single.term)

    await expect(productsPage.cards).toHaveCount(SEARCH_TERMS.single.expectedCount)
  })

  test('busca sem acento encontra categoria acentuada', async ({ productsPage }) => {
    /*
     * "audio" precisa encontrar "Áudio". A aplicação normaliza os diacríticos antes de
     * comparar — sem isso, o usuário brasileiro que não digita acento não acha nada.
     */
    await productsPage.search(SEARCH_TERMS.unaccented.term)

    await expect(productsPage.cards).toHaveCount(SEARCH_TERMS.unaccented.expectedCount)
  })

  test('termos fora de ordem devolvem o mesmo resultado', async ({ productsPage }) => {
    await productsPage.search(SEARCH_TERMS.multiWord.term)

    await expect(productsPage.cards).toHaveCount(SEARCH_TERMS.multiWord.expectedCount)
  })

  test('busca casa com nome e também com descrição', async ({ productsPage }) => {
    // "fone" casa com "Fone Aurora Pro" (nome) e "Earbuds Nova Air" (descrição).
    await productsPage.search(SEARCH_TERMS.partial.term)

    await expect(productsPage.cards).toHaveCount(SEARCH_TERMS.partial.expectedCount)
  })

  test('pesquisa sem resultado mostra estado vazio, não tela em branco', async ({
    productsPage,
  }) => {
    await productsPage.search(SEARCH_TERMS.none.term)

    await expect(productsPage.emptyState).toBeVisible()
    await expect(productsPage.cards).toHaveCount(0)
  })

  test('limpar a pesquisa restaura o catálogo', async ({ productsPage }) => {
    await productsPage.search(SEARCH_TERMS.single.term)
    await expect(productsPage.cards).toHaveCount(SEARCH_TERMS.single.expectedCount)

    await productsPage.clearSearch()

    await expect(productsPage.cards).toHaveCount(CATALOG_SIZE)
  })

  test('o termo pesquisado vai para a URL', async ({ productsPage, page }) => {
    await productsPage.search(SEARCH_TERMS.single.term)

    await expect(page).toHaveURL(new RegExp(`${PRODUCT_PARAMS.search}=${SEARCH_TERMS.single.term}`))
  })

  test('pesquisa combinada com filtro de categoria', async ({ productsPage }) => {
    await productsPage.filterByCategory('Periféricos')
    await productsPage.search('mouse')

    await expect(productsPage.cards).toHaveCount(1)
  })
})
