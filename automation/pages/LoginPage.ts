import { expect, type Locator } from '@playwright/test'

import { BasePage } from '@pages/BasePage'
import type { TestUser } from '@data/users'
import { ROUTES } from '@utils/routes'

export class LoginPage extends BasePage {
  protected readonly path = ROUTES.login
  protected readonly readyLocator: Locator = this.byTestId('login-form')

  private get emailInput(): Locator {
    return this.byTestId('login-email')
  }

  private get passwordInput(): Locator {
    return this.byTestId('login-password')
  }

  /**
   * Botao de envio. Publico porque o spec assevera o estado de carregamento nele.
   *
   * Expor o LOCATOR nao viola o ADR-003: a string do seletor continua aqui dentro. O que
   * o spec recebe e um objeto ja resolvido — trocar `data-testid` por outra estrategia
   * segue sendo uma mudanca em um arquivo so.
   */
  get submitButton(): Locator {
    return this.byTestId('login-submit')
  }

  /** Erro geral do formulário (credenciais recusadas pelo serviço). */
  get formError(): Locator {
    return this.byTestId('login-error')
  }

  /** Erro de um campo específico. A aplicação nomeia como `<campo>-error`. */
  fieldError(field: 'email' | 'password'): Locator {
    return this.byTestId(`${field}-error`)
  }

  /**
   * Preenche e envia o formulário.
   *
   * NÃO espera pelo sucesso: é usada tanto por cenários positivos quanto negativos.
   * Quem chama decide o que asseverar — evitando um método que só serve para o caso feliz.
   */
  async submitCredentials(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  /** Autentica e aguarda a saída da tela de login. */
  async loginAs(user: TestUser): Promise<void> {
    await this.submitCredentials(user.email, user.password)
    await expect(this.page).not.toHaveURL(new RegExp(ROUTES.login))
  }

  /**
   * Autentica esperando que a tentativa FALHE.
   *
   * Existe separado de `loginAs` porque as esperas são opostas: aqui o correto é
   * permanecer no login. Um método único com flag booleana esconderia essa diferença.
   */
  async loginAsExpectingFailure(user: TestUser): Promise<void> {
    await this.submitCredentials(user.email, user.password)
    await expect(this.page).toHaveURL(new RegExp(ROUTES.login))
  }

  async fillEmail(value: string): Promise<void> {
    await this.emailInput.fill(value)
  }

  async fillPassword(value: string): Promise<void> {
    await this.passwordInput.fill(value)
  }

  /** Envia o formulário sem preencher nada, para exercitar campos obrigatórios. */
  async submitEmpty(): Promise<void> {
    await this.emailInput.fill('')
    await this.passwordInput.fill('')
    await this.submitButton.click()
  }
}
