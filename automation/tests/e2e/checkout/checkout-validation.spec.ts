import { CHECKOUT_MESSAGES, CPF, CUSTOMER, EXPECTED_MASKS } from '@data/customers'
import { PRODUCTS } from '@data/products'
import { expect, test } from '@fixtures/test'
import { ROUTES } from '@utils/routes'

/** Todo cenário de validação precisa de um carrinho com item, senão o checkout redireciona. */
test.beforeEach(async ({ productDetailPage, checkoutPage }) => {
  await productDetailPage.openProduct(PRODUCTS.mouse.id)
  await productDetailPage.addToCart()
  await checkoutPage.open()
})

test.describe('Checkout — validação', () => {
  test('campos obrigatórios bloqueiam o envio', async ({ checkoutPage, page }) => {
    await checkoutPage.clearField('fullName')
    await checkoutPage.clearField('email')
    await checkoutPage.submit()

    await expect(checkoutPage.fieldError('fullName')).toHaveText(CHECKOUT_MESSAGES.requiredFullName)
    await expect(checkoutPage.fieldError('cpf')).toHaveText(CHECKOUT_MESSAGES.requiredCpf)
    await expect(checkoutPage.fieldError('zipCode')).toHaveText(CHECKOUT_MESSAGES.requiredZipCode)
    await expect(page).toHaveURL(new RegExp(ROUTES.checkout))
  })

  test('nome sem sobrenome é rejeitado', async ({ checkoutPage }) => {
    await checkoutPage.placeOrder(CUSTOMER, { fullName: 'Gabriel' })

    await expect(checkoutPage.fieldError('fullName')).toHaveText(CHECKOUT_MESSAGES.missingLastName)
  })

  test('CPF com dígito verificador incorreto é rejeitado', async ({ checkoutPage }) => {
    /*
     * Prova que a validação calcula os dígitos verificadores, e não apenas conta
     * caracteres — este CPF tem 11 dígitos e mesmo assim é inválido.
     */
    await checkoutPage.placeOrder(CUSTOMER, { cpf: CPF.invalidCheckDigit })

    await expect(checkoutPage.fieldError('cpf')).toHaveText(CHECKOUT_MESSAGES.invalidCpf)
  })

  test('CPF de dígitos repetidos é rejeitado', async ({ checkoutPage }) => {
    await checkoutPage.placeOrder(CUSTOMER, { cpf: CPF.repeatedDigits })

    await expect(checkoutPage.fieldError('cpf')).toHaveText(CHECKOUT_MESSAGES.invalidCpf)
  })

  test('CPF incompleto é rejeitado', async ({ checkoutPage }) => {
    await checkoutPage.placeOrder(CUSTOMER, { cpf: CPF.incomplete })

    await expect(checkoutPage.fieldError('cpf')).toHaveText(CHECKOUT_MESSAGES.invalidCpf)
  })

  test('CEP incompleto é rejeitado', async ({ checkoutPage }) => {
    await checkoutPage.placeOrder(CUSTOMER, { zipCode: '0131' })

    await expect(checkoutPage.fieldError('zipCode')).toHaveText(CHECKOUT_MESSAGES.incompleteZipCode)
  })

  test('telefone incompleto é rejeitado', async ({ checkoutPage }) => {
    await checkoutPage.placeOrder(CUSTOMER, { phone: '119876' })

    await expect(checkoutPage.fieldError('phone')).toHaveText(CHECKOUT_MESSAGES.incompletePhone)
  })

  test('complemento é opcional', async ({ checkoutPage, orderSuccessPage }) => {
    await checkoutPage.placeOrder(CUSTOMER, { complement: '' })

    await orderSuccessPage.waitUntilReady()
  })

  test('o erro do campo some assim que ele é corrigido', async ({ checkoutPage }) => {
    await checkoutPage.clearField('fullName')
    await checkoutPage.submit()
    await expect(checkoutPage.fieldError('fullName')).toHaveText(CHECKOUT_MESSAGES.requiredFullName)

    await checkoutPage.fillField('fullName', CUSTOMER.fullName)

    await expect(checkoutPage.fieldError('fullName')).toBeHidden()
  })
})

test.describe('Checkout — máscaras', () => {
  test('CPF, CEP e telefone são formatados durante a digitação', async ({ checkoutPage }) => {
    await checkoutPage.fillField('cpf', CPF.valid)
    await expect(checkoutPage.field('cpf')).toHaveValue(EXPECTED_MASKS.cpf)

    await checkoutPage.fillField('zipCode', CUSTOMER.zipCode)
    await expect(checkoutPage.field('zipCode')).toHaveValue(EXPECTED_MASKS.zipCode)

    await checkoutPage.fillField('phone', CUSTOMER.phone)
    await expect(checkoutPage.field('phone')).toHaveValue(EXPECTED_MASKS.mobilePhone)
  })

  test('telefone fixo usa formato de 8 dígitos', async ({ checkoutPage }) => {
    await checkoutPage.fillField('phone', '1133334444')

    await expect(checkoutPage.field('phone')).toHaveValue(EXPECTED_MASKS.landlinePhone)
  })

  test('a máscara ignora letras e corta o excesso de dígitos', async ({ checkoutPage }) => {
    await checkoutPage.fillField('cpf', `abc${CPF.valid}999999`)

    await expect(checkoutPage.field('cpf')).toHaveValue(EXPECTED_MASKS.cpf)
  })
})

test.describe('Checkout — pré-condições', () => {
  test('carrinho vazio devolve o usuário ao carrinho', async ({ cartPage, page }) => {
    await cartPage.open()
    await cartPage.clearCart()

    await page.goto(ROUTES.checkout)

    await cartPage.expectToBeCurrentPage()
  })

  test('dados pessoais vêm pré-preenchidos da sessão', async ({ checkoutPage }) => {
    await expect(checkoutPage.field('fullName')).toHaveValue(CUSTOMER.fullName)
    await expect(checkoutPage.field('email')).toHaveValue(CUSTOMER.email)
  })
})
