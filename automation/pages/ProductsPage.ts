import { expect, type Locator } from '@playwright/test'

import { BasePage } from '@pages/BasePage'
import { HeaderComponent } from '@pages/components/HeaderComponent'
import { PRODUCT_PARAMS, ROUTES, productsWith } from '@utils/routes'
import { readCents } from '@utils/money'

export class ProductsPage extends BasePage {
  protected readonly path = ROUTES.products
  protected readonly readyLocator: Locator = this.byTestId('products-page')

  readonly header = new HeaderComponent(this.page)

  readonly cards: Locator = this.byTestId('product-card')
  readonly resultCount: Locator = this.byTestId('products-count')
  readonly emptyState: Locator = this.byTestId('products-empty')

  private get searchInput(): Locator {
    return this.byTestId('product-search')
  }

  /**
   * Abre a listagem já com filtros aplicados.
   *
   * Possível porque os filtros vivem na URL: montar o estado por navegação é muito mais
   * rápido e estável do que clicar em cada controle para chegar lá. Reserve os cliques
   * para os testes que estão de fato validando os controles.
   */
  async openWith(params: Record<string, string>): Promise<void> {
    await this.page.goto(productsWith(params))
    await this.waitUntilReady()
  }

  /**
   * Espera a query string refletir a mudança de filtro.
   *
   * Este é o ponto de sincronização confiável da tela. Esperar apenas "o skeleton sumiu"
   * é uma corrida: logo após o clique o skeleton ainda NÃO apareceu, a asserção passa
   * contra o resultado antigo e a leitura seguinte pega a grade no meio da troca — foi
   * exatamente assim que o teste de ordenação leu uma lista vazia.
   */
  private async waitForParam(param: string, value: string | null): Promise<void> {
    await expect.poll(() => new URL(this.page.url()).searchParams.get(param)).toBe(value)
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term)
    // A busca tem debounce de 300 ms; a URL só muda quando ele expira.
    await this.waitForParam(PRODUCT_PARAMS.search, term || null)
    await this.waitForResults()
  }

  async clearSearch(): Promise<void> {
    await this.byTestId('product-search-clear').click()
    await this.waitForParam(PRODUCT_PARAMS.search, null)
    await this.waitForResults()
  }

  async filterByCategory(category: string): Promise<void> {
    await this.byTestId('product-category-filter').selectOption(category)
    await this.waitForParam(PRODUCT_PARAMS.category, category)
    await this.waitForResults()
  }

  async sortBy(sort: string): Promise<void> {
    await this.byTestId('product-sort').selectOption(sort)
    // "relevance" é o padrão e some da URL em vez de aparecer como parâmetro.
    await this.waitForParam(PRODUCT_PARAMS.sort, sort === 'relevance' ? null : sort)
    await this.waitForResults()
  }

  /**
   * Marca o filtro de "somente em estoque".
   *
   * Usa `click()` + asserção em vez de `check()`: o estado do filtro volta pela URL e o
   * `navigate` do React Router roda em `startTransition`, então existe uma janela de
   * ~15 ms em que o input ainda está desmarcado. `check()` assevera imediatamente após o
   * clique e falha nessa janela; `toBeChecked()` reexecuta até estabilizar.
   */
  async toggleInStockOnly(): Promise<void> {
    const checkbox = this.byTestId('product-in-stock-filter')
    const wasChecked = await checkbox.isChecked()

    await checkbox.click()
    await expect(checkbox).toBeChecked({ checked: !wasChecked })
    await this.waitForParam(PRODUCT_PARAMS.inStock, wasChecked ? null : '1')
    await this.waitForResults()
  }

  async clearFilters(): Promise<void> {
    await this.byTestId('product-clear-filters').click()
    await expect.poll(() => new URL(this.page.url()).search).toBe('')
    await this.waitForResults()
  }

  /**
   * Aguarda a grade estar estável.
   *
   * Duas condições, não uma: o skeleton precisa ter saído E a tela precisa estar em um
   * estado terminal (grade com produtos ou estado vazio). Só a primeira condição deixaria
   * passar o instante em que a grade foi desmontada e ainda não voltou.
   */
  async waitForResults(): Promise<void> {
    await expect(this.byTestId('products-loading')).toBeHidden()
    await expect(this.byTestId('products-grid').or(this.emptyState)).toBeVisible()
  }

  async openProduct(name: string): Promise<void> {
    await this.cards.filter({ hasText: name }).getByTestId('product-name').click()
  }

  async addToCart(name: string): Promise<void> {
    await this.cards.filter({ hasText: name }).getByTestId('add-to-cart').click()
  }

  async expectResultCount(count: number): Promise<void> {
    await expect(this.cards).toHaveCount(count)
  }

  /** Preços exibidos, em centavos, na ordem em que aparecem na grade. */
  async visiblePrices(): Promise<number[]> {
    return this.byTestId('product-price').evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('data-price-cents'))),
    )
  }

  /** Nomes exibidos na grade, na ordem em que aparecem. */
  async visibleNames(): Promise<string[]> {
    return this.cards.getByTestId('product-name').allTextContents()
  }

  async priceOf(name: string): Promise<number> {
    return readCents(this.cards.filter({ hasText: name }).getByTestId('product-price'))
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible()
    await expect(this.cards).toHaveCount(0)
  }
}
