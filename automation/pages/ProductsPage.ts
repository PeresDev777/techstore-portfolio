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

  /** Seletor de categoria. Publico: o spec assevera que o estado sobrevive ao reload. */
  get categoryFilter(): Locator {
    return this.byTestId('product-category-filter')
  }

  /** Selo de esgotado no card de um produto. */
  outOfStockBadgeFor(name: string): Locator {
    return this.cards.filter({ hasText: name }).getByTestId('product-out-of-stock')
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

  /**
   * Aplica um filtro e so devolve o controle quando a RESPOSTA da API chegou.
   *
   * Esta e a terceira tentativa de sincronizar esta tela, e as duas anteriores erraram o
   * alvo pelo mesmo motivo — esperavam por um efeito, nao pela causa:
   *
   * | Espera | Por que nao basta |
   * | --- | --- |
   * | O skeleton sumiu | Logo apos o clique ele ainda NAO apareceu (ADR-018) |
   * | A query string mudou | A URL muda antes de a requisicao sair |
   * | A grade tem cards | Sao os cards ANTIGOS; a troca vem depois |
   *
   * O ultimo caso e o mais traicoeiro e so apareceu no CI: as tres condicoes passavam
   * contra o estado ANTERIOR, o teste seguia, e a grade esvaziava por um instante enquanto
   * a resposta nova era renderizada. `visiblePrices()` lia `[]` ali.
   *
   * A resposta HTTP e a unica causa observavel que nao existe antes da acao. Registrar o
   * `waitForResponse` ANTES de agir e o que evita perde-la.
   */
  private async applyingFilter(action: () => Promise<void>): Promise<void> {
    const responded = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/products'),
      { timeout: 15_000 },
    )

    await action()
    await responded
    await this.waitForResults()
  }

  async search(term: string): Promise<void> {
    await this.applyingFilter(async () => {
      await this.searchInput.fill(term)
      // A busca tem debounce de 300 ms; a URL só muda quando ele expira.
      await this.waitForParam(PRODUCT_PARAMS.search, term || null)
    })
  }

  async clearSearch(): Promise<void> {
    await this.applyingFilter(async () => {
      await this.byTestId('product-search-clear').click()
      await this.waitForParam(PRODUCT_PARAMS.search, null)
    })
  }

  async filterByCategory(category: string): Promise<void> {
    await this.applyingFilter(async () => {
      await this.categoryFilter.selectOption(category)
      await this.waitForParam(PRODUCT_PARAMS.category, category)
    })
  }

  async sortBy(sort: string): Promise<void> {
    await this.applyingFilter(async () => {
      await this.byTestId('product-sort').selectOption(sort)
      // "relevance" é o padrão e some da URL em vez de aparecer como parâmetro.
      await this.waitForParam(PRODUCT_PARAMS.sort, sort === 'relevance' ? null : sort)
    })
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

    await this.applyingFilter(async () => {
      await checkbox.click()
      await expect(checkbox).toBeChecked({ checked: !wasChecked })
      await this.waitForParam(PRODUCT_PARAMS.inStock, wasChecked ? null : '1')
    })
  }

  async clearFilters(): Promise<void> {
    await this.applyingFilter(async () => {
      await this.byTestId('product-clear-filters').click()
      await expect.poll(() => new URL(this.page.url()).search).toBe('')
    })
  }

  /**
   * Aguarda a grade estar estável.
   *
   * TRÊS condições, e a terceira custou uma execução vermelha no CI para aparecer.
   *
   * As duas primeiras — o skeleton saiu, e existe grade ou estado vazio — deixam passar um
   * instante em que o CONTAINER da grade já está montado e ainda não tem cards dentro. O
   * teste de ordenação leu uma lista vazia nesse instante e falhou com
   * `expect(prices[0]).toBe(44990)` recebendo `undefined`.
   *
   * "O elemento existe" e "o elemento tem conteúdo" são perguntas diferentes. É o ADR-018
   * um nível mais fundo: esperar pela causa observável significa esperar pelo DADO, não
   * pelo invólucro que vai contê-lo.
   *
   * A terceira condição usa `.or(emptyState)` para não quebrar a busca sem resultado, onde
   * zero cards é o estado correto e terminal.
   */
  async waitForResults(): Promise<void> {
    await expect(this.byTestId('products-loading')).toBeHidden()
    await expect(this.byTestId('products-grid').or(this.emptyState)).toBeVisible()
    await expect(this.cards.first().or(this.emptyState)).toBeVisible()
  }

  async openProduct(name: string): Promise<void> {
    await this.cards.filter({ hasText: name }).getByTestId('product-name').click()
  }

  async addToCart(name: string): Promise<void> {
    await this.mutatingCart(() =>
      this.cards.filter({ hasText: name }).getByTestId('add-to-cart').click(),
    )
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
}
