import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { CUSTOMER } from '@data/customers'
import { PRODUCTS } from '@data/products'
import { USERS } from '@data/users'
import { expect, test } from '@fixtures/test'
import { test as anonymousTest } from '@fixtures/anonymous'

/**
 * Acessibilidade — WCAG 2.1 nivel AA.
 *
 * **Por que uma dependencia nova se justifica aqui.** WCAG tem dezenas de criterios
 * verificaveis por maquina — contraste, rotulo de campo, ordem de cabecalho, `alt`, papel
 * ARIA valido. Escrever isso a mao seria reimplementar o `axe-core`, que e o mesmo motor
 * que o Lighthouse e as extensoes de navegador usam. Nao ha versao caseira defensavel.
 *
 * **O que este teste NAO prova.** Verificacao automatica alcanca cerca de um terco dos
 * criterios de WCAG. Ela nao diz se a ordem de tabulacao faz sentido, se o texto
 * alternativo DESCREVE a imagem ou se o fluxo e navegavel por leitor de tela. Zero
 * violacoes aqui significa "nenhum defeito mecanico", nao "acessivel" — e chamar isso de
 * acessivel seria o mesmo erro de chamar cobertura de linha de "testado".
 *
 * **Estado inicial, medido antes de decidir o que asseverar.** A sondagem encontrou uma
 * unica classe de problema em cinco telas: contraste em dois tokens de cor. Como o numero
 * era corrigivel, os tokens foram ajustados e o alvo passou a ser ZERO — que e uma posicao
 * muito mais forte que congelar as violacoes existentes numa baseline.
 */

/** Executa o axe e assevera zero violacoes, com o detalhe no erro. */
async function expectNoViolations(page: Page): Promise<void> {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const resumo = resultado.violations.map(
    (violacao) =>
      `[${violacao.impact}] ${violacao.id} (${violacao.nodes.length}x) — ${violacao.help}\n` +
      violacao.nodes
        .map((node) => `    ${node.target.join(' ')}\n    ${node.html.slice(0, 120)}`)
        .join('\n'),
  )

  expect(resultado.violations, `violacoes de WCAG 2.1 AA:\n${resumo.join('\n')}`).toEqual([])
}

anonymousTest.describe('Acessibilidade — telas publicas', () => {
  anonymousTest('login', async ({ loginPage, page }) => {
    await loginPage.open()

    await expectNoViolations(page)
  })

  anonymousTest('login com erro exibido', async ({ loginPage, page }) => {
    /*
     * O estado de ERRO importa tanto quanto o normal: mensagem de erro costuma nascer com
     * contraste baixo e sem associacao ao campo, e e o momento em que o usuario mais
     * precisa entender o que aconteceu.
     */
    await loginPage.open()
    await loginPage.submitEmpty()
    await expect(loginPage.fieldError('email')).toBeVisible()

    await expectNoViolations(page)
  })
})

test.describe('Acessibilidade — telas autenticadas', () => {
  test('dashboard', async ({ dashboardPage, page }) => {
    await dashboardPage.open()

    await expectNoViolations(page)
  })

  test('listagem de produtos', async ({ productsPage, page }) => {
    await productsPage.open()
    await productsPage.waitForResults()

    await expectNoViolations(page)
  })

  test('listagem sem resultados', async ({ productsPage, page }) => {
    await productsPage.open()
    await productsPage.search('xyzabc')
    await expect(productsPage.emptyState).toBeVisible()

    await expectNoViolations(page)
  })

  test('detalhe do produto', async ({ productDetailPage, page }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)

    await expectNoViolations(page)
  })

  test('carrinho vazio', async ({ cartPage, page }) => {
    await cartPage.open()
    await expect(cartPage.emptyState).toBeVisible()

    await expectNoViolations(page)
  })

  test('carrinho com itens', async ({ productDetailPage, cartPage, page }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await cartPage.open()

    await expectNoViolations(page)
  })

  test('checkout preenchido', async ({ productDetailPage, checkoutPage, page }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await checkoutPage.open()
    await checkoutPage.fillForm(CUSTOMER)

    await expectNoViolations(page)
  })

  test('confirmacao do pedido', async ({
    productDetailPage,
    checkoutPage,
    orderSuccessPage,
    page,
  }) => {
    await productDetailPage.openProduct(PRODUCTS.mouse.id)
    await productDetailPage.addToCart()
    await checkoutPage.open()
    await checkoutPage.placeOrder(CUSTOMER)
    await orderSuccessPage.waitUntilReady()

    await expectNoViolations(page)
  })
})

anonymousTest.describe('Acessibilidade — navegacao por teclado', () => {
  anonymousTest(
    'o formulario de login e operavel so com o teclado',
    async ({ page, loginPage, dashboardPage }) => {
      /*
       * O unico criterio aqui que o axe NAO alcanca. Verificacao automatica confere se os
       * elementos sao focaveis; ela nao confere se a ORDEM leva a algum lugar. Um formulario
       * pode ter todos os rotulos corretos e ainda ser impossivel de enviar sem mouse.
       *
       * O fluxo de login e o escolhido porque e a porta de entrada: se ele nao for operavel
       * por teclado, nada depois dele importa.
       *
       * Usa a fixture ANONIMA: com a sessao ja gravada no `storageState`, `/login`
       * redireciona para o dashboard e o formulario nem chega a existir. A primeira versao
       * deste teste usou a fixture autenticada e falhou por isso.
       */
      await loginPage.open()

      await loginPage.emailInput.focus()
      await page.keyboard.type(USERS.valid.email)

      await page.keyboard.press('Tab')
      await page.keyboard.type(USERS.valid.password)

      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')

      await dashboardPage.expectToBeCurrentPage()
    },
  )
})
