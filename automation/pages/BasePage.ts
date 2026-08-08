import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Base de todos os Page Objects.
 *
 * Concentra o que TODA página tem em comum: como abrir, como provar que terminou de
 * carregar e como localizar elementos. Sem essa base, cada page object reinventaria
 * `goto` + espera, e cada um esperaria de um jeito ligeiramente diferente — a origem
 * mais comum de flakiness em suítes E2E.
 *
 * Regra de projeto: subclasses expõem AÇÕES DE NEGÓCIO (`login`, `addToCart`), nunca
 * locators. Um spec que precisa alcançar um seletor cru é sinal de que falta um método
 * no page object.
 */
export abstract class BasePage {
  protected readonly page: Page

  /** Caminho da rota que esta página representa. */
  protected abstract readonly path: string

  /**
   * Elemento que só existe quando a página terminou de renderizar.
   * É o que transforma "abri a URL" em "a página está pronta".
   */
  protected abstract readonly readyLocator: Locator

  constructor(page: Page) {
    this.page = page
  }

  /** Abre a página e só devolve o controle quando ela estiver pronta. */
  async open(): Promise<void> {
    await this.page.goto(this.path)
    await this.waitUntilReady()
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.readyLocator).toBeVisible()
  }

  /** Assevera que o navegador está nesta página. */
  async expectToBeCurrentPage(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.escapeForUrl(this.path)))
    await this.waitUntilReady()
  }

  /**
   * Locator por `data-testid` — o contrato de testabilidade acordado com a aplicação.
   * Centralizado aqui para que trocar a estratégia de localização seja uma mudança
   * em UM lugar, não em cada page object.
   */
  protected byTestId(testId: string): Locator {
    return this.page.getByTestId(testId)
  }

  /** Escapa o caminho para uso seguro dentro de uma expressão regular de URL. */
  private escapeForUrl(path: string): string {
    return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Executa uma ação que MUTA o carrinho no servidor e só devolve o controle quando a
   * resposta chegou.
   *
   * **Corrige uma corrida real, encontrada na auditoria da suíte.** `locator.click()`
   * resolve quando o clique é despachado — não quando a requisição que ele dispara
   * termina. O carrinho usa cache otimista (ADR-046): a tela e o badge reagem na hora,
   * pela via local, e o `POST /cart/items` segue em voo. Um `page.goto()` logo depois
   * **aborta** essa requisição, e o item nunca chega ao servidor.
   *
   * O sintoma era o pior possível: passava isolado e falhava na suíte completa, porque a
   * janela depende da carga da máquina. Parecia flakiness e era uma dependência de tempo
   * não declarada — o item chegava no servidor por sorte.
   *
   * Esperar pelo BADGE não resolveria: ele é atualizado pelo redutor local antes de
   * qualquer resposta, então subiria com a requisição ainda em voo. A única prova de que
   * o servidor recebeu é a própria resposta.
   *
   * É o ADR-018 aplicado às mutações: **espere pela causa observável, não pelo sintoma.**
   */
  protected async mutatingCart(action: () => Promise<void>): Promise<void> {
    const settled = this.page.waitForResponse(
      (response) => response.url().includes('/cart') && response.request().method() !== 'GET',
      { timeout: 10_000 },
    )

    await action()
    await settled
  }

  /**
   * Anexa uma captura ao relatório HTML como evidência de um passo relevante.
   *
   * Complementa — não substitui — o `screenshot: only-on-failure` da configuração:
   * serve para registrar um marco do fluxo (o pedido confirmado, por exemplo) mesmo
   * quando o teste passa.
   */
  async attachScreenshot(name: string): Promise<void> {
    await test.info().attach(name, {
      body: await this.page.screenshot(),
      contentType: 'image/png',
    })
  }
}
