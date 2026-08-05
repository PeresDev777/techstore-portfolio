import { expect, type Locator } from '@playwright/test'

import { BasePage } from '@pages/BasePage'
import { HeaderComponent } from '@pages/components/HeaderComponent'
import type { CheckoutData } from '@data/customers'
import { ROUTES } from '@utils/routes'
import { readCents } from '@utils/money'

/** Campos de texto do formulário, na ordem em que aparecem na tela. */
const TEXT_FIELDS = [
  'fullName',
  'email',
  'cpf',
  'phone',
  'zipCode',
  'street',
  'number',
  'complement',
  'district',
  'city',
] as const

type TextField = (typeof TEXT_FIELDS)[number]
export type CheckoutField = TextField | 'state'

export class CheckoutPage extends BasePage {
  protected readonly path = ROUTES.checkout
  protected readonly readyLocator: Locator = this.byTestId('checkout-form')

  readonly header = new HeaderComponent(this.page)

  readonly formError: Locator = this.byTestId('checkout-error')
  readonly summaryItems: Locator = this.byTestId('summary-item')

  field(name: CheckoutField): Locator {
    return this.byTestId(`checkout-${name}`)
  }

  fieldError(name: CheckoutField): Locator {
    return this.byTestId(`${name}-error`)
  }

  async fillField(name: TextField, value: string): Promise<void> {
    await this.field(name).fill(value)
  }

  /**
   * Preenche o formulário inteiro.
   *
   * `overrides` permite que um spec altere apenas o campo sob teste e mantenha o resto
   * válido — sem isso, cada cenário negativo precisaria repetir os onze campos e a
   * intenção do teste ficaria enterrada no ruído.
   */
  async fillForm(data: CheckoutData, overrides: Partial<CheckoutData> = {}): Promise<void> {
    const values = { ...data, ...overrides }

    for (const field of TEXT_FIELDS) {
      await this.fillField(field, values[field])
    }

    await this.field('state').selectOption(values.state)
  }

  /** Esvazia um campo para exercitar obrigatoriedade. */
  async clearField(name: TextField): Promise<void> {
    await this.field(name).fill('')
  }

  async submit(): Promise<void> {
    await this.byTestId('checkout-submit').click()
  }

  /** Preenche e envia — atalho para os cenários que só querem chegar ao sucesso. */
  async placeOrder(data: CheckoutData, overrides: Partial<CheckoutData> = {}): Promise<void> {
    await this.fillForm(data, overrides)
    await this.submit()
  }

  async expectFieldError(name: CheckoutField, message: string): Promise<void> {
    await expect(this.fieldError(name)).toHaveText(message)
  }

  async expectNoFieldError(name: CheckoutField): Promise<void> {
    await expect(this.fieldError(name)).toBeHidden()
  }

  async expectMaskedValue(name: CheckoutField, masked: string): Promise<void> {
    await expect(this.field(name)).toHaveValue(masked)
  }

  /** Os campos pessoais já vêm preenchidos com os dados da sessão. */
  async expectPrefilledFrom(name: string, email: string): Promise<void> {
    await expect(this.field('fullName')).toHaveValue(name)
    await expect(this.field('email')).toHaveValue(email)
  }

  async summaryTotalInCents(): Promise<number> {
    return readCents(this.byTestId('summary-total'))
  }

  async summarySubtotalInCents(): Promise<number> {
    return readCents(this.byTestId('summary-subtotal'))
  }

  async summaryShippingInCents(): Promise<number> {
    return readCents(this.byTestId('summary-shipping'))
  }

  async expectSummaryItemCount(count: number): Promise<void> {
    await expect(this.summaryItems).toHaveCount(count)
  }
}
