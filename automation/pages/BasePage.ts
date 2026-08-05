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
