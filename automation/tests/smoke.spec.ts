import { expect, test } from '@playwright/test'

/**
 * Teste de infraestrutura, nao de funcionalidade.
 *
 * Valida que a esteira completa esta de pe: build do frontend, servidor de preview,
 * Playwright conectando na baseURL e gerando evidencias. Serve como canario — se ele
 * falhar, o problema e de ambiente/configuracao, nao da aplicacao.
 *
 * Sera substituido pelos specs reais conforme as funcionalidades forem entregues.
 */
test.describe('Infraestrutura', () => {
  test('aplicacao responde na baseURL e renderiza o app React', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/TechStore/)
    await expect(page.getByRole('heading', { name: 'TechStore' })).toBeVisible()
  })
})
