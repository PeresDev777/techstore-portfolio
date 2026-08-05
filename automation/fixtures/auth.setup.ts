import { expect, test as setup } from '@playwright/test'

import { USERS } from '@data/users'
import { LoginPage } from '@pages/LoginPage'
import { ROUTES } from '@utils/routes'
import { AUTH_STATE_FILE } from '@fixtures/paths'

/**
 * Projeto de setup: autentica UMA vez e salva o estado do navegador em disco.
 *
 * Todos os demais testes iniciam já logados carregando esse arquivo, em vez de repetir o
 * fluxo de login. Ganhos:
 *
 * - Velocidade: o login pela UI custa ~1 s por teste. Com dezenas de testes, isso domina
 *   o tempo da suíte sem acrescentar cobertura.
 * - Isolamento de falha: se o login quebrar, um único teste falha em vez de a suíte
 *   inteira ficar vermelha e esconder o defeito real.
 *
 * Os testes de login continuam exercitando o fluxo real pela UI — eles descartam este
 * estado explicitamente (`test.use({ storageState: ... })`).
 */
setup('autentica e salva o estado da sessão', async ({ page }) => {
  const loginPage = new LoginPage(page)

  await loginPage.open()
  await loginPage.loginAs(USERS.valid)

  // Confirma que a sessão realmente existe antes de gravá-la.
  await expect(page).toHaveURL(new RegExp(ROUTES.dashboard))
  await expect(page.getByTestId('dashboard-title')).toBeVisible()

  await page.context().storageState({ path: AUTH_STATE_FILE })
})
