import { expect, type Locator } from '@playwright/test'

import { BasePage } from '@pages/BasePage'
import { HeaderComponent } from '@pages/components/HeaderComponent'
import { ORDER_ID_PATTERN, type CheckoutData } from '@data/customers'
import { ROUTES } from '@utils/routes'
import { readCents } from '@utils/money'

export class OrderSuccessPage extends BasePage {
  protected readonly path = ROUTES.orderSuccess
  protected readonly readyLocator: Locator = this.byTestId('order-success-page')

  readonly header = new HeaderComponent(this.page)

  readonly orderNumber: Locator = this.byTestId('order-number')
  readonly customerName: Locator = this.byTestId('order-customer-name')
  readonly customerCpf: Locator = this.byTestId('order-customer-cpf')
  readonly customerPhone: Locator = this.byTestId('order-customer-phone')
  readonly address: Locator = this.byTestId('order-address')

  async expectOrderNumberFormat(): Promise<void> {
    await expect(this.orderNumber).toHaveText(ORDER_ID_PATTERN)
  }

  async orderId(): Promise<string> {
    return (await this.orderNumber.textContent()) ?? ''
  }

  async totalInCents(): Promise<number> {
    return readCents(this.byTestId('summary-total'))
  }

  /**
   * Confere que a confirmação reflete o que foi digitado no checkout.
   *
   * **Fica como INVARIANTE, e nao como expectativa de um teste.** A relacao asseverada e
   * "o que a confirmacao mostra e o que o checkout enviou" — verdadeira para qualquer
   * comprador e qualquer endereco, independente da massa. Move-la para o spec obrigaria a
   * repetir sete asseveracoes em cada cenario de compra, sem que o teste ganhasse uma
   * afirmacao propria: ele continuaria dizendo exatamente isto.
   *
   * As mascaras chegam por parametro porque o formulario guarda digitos puros e a
   * confirmacao exibe formatado — asseverar isso prova que a conversao aconteceu nas duas
   * pontas.
   */
  async expectOrderMatches(
    data: CheckoutData,
    masks: { cpf: string; phone: string; zipCode: string },
  ): Promise<void> {
    await expect(this.customerName).toHaveText(data.fullName)
    await expect(this.customerCpf).toHaveText(`CPF ${masks.cpf}`)
    await expect(this.customerPhone).toHaveText(masks.phone)

    await expect(this.address).toContainText(`${data.street}, ${data.number}`)
    await expect(this.address).toContainText(data.complement)
    await expect(this.address).toContainText(`${data.city}/${data.state}`)
    await expect(this.address).toContainText(`CEP ${masks.zipCode}`)
  }

  async continueShopping(): Promise<void> {
    await this.byTestId('order-continue').click()
  }
}
