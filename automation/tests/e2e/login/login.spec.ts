import { AUTH_MESSAGES, USERS, WRONG_PASSWORD } from '@data/users'
import { expect, test } from '@fixtures/anonymous'
import { ROUTES } from '@utils/routes'

/**
 * Cenários de autenticação.
 *
 * Usa o `test` anônimo: estes são os únicos cenários que exercitam o login pela UI.
 * O resto da suíte parte do estado autenticado gravado pelo projeto de setup.
 */
test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.open()
  })

  test(
    'login com credenciais válidas leva ao dashboard',
    { tag: ['@smoke', '@critical'] },
    async ({ loginPage, dashboardPage }) => {
      await loginPage.loginAs(USERS.valid)

      await dashboardPage.expectToBeCurrentPage()
      await dashboardPage.expectGreeting(USERS.valid.name)
      await dashboardPage.header.expectLoggedInAs(USERS.valid.name)
    },
  )

  test('e-mail inexistente é recusado', async ({ loginPage, page }) => {
    await loginPage.submitCredentials(USERS.unknown.email, USERS.unknown.password)

    await loginPage.expectFormError(AUTH_MESSAGES.invalidCredentials)
    await expect(page).toHaveURL(new RegExp(ROUTES.login))
  })

  test('senha incorreta é recusada', async ({ loginPage, page }) => {
    await loginPage.submitCredentials(USERS.valid.email, WRONG_PASSWORD)

    await loginPage.expectFormError(AUTH_MESSAGES.invalidCredentials)
    await expect(page).toHaveURL(new RegExp(ROUTES.login))
  })

  test('e-mail inexistente e senha errada devolvem a MESMA mensagem', async ({ loginPage }) => {
    /*
     * Requisito de segurança, não de usabilidade: mensagens distintas permitiriam a um
     * atacante descobrir quais e-mails estão cadastrados testando um por um.
     */
    await loginPage.submitCredentials(USERS.unknown.email, USERS.unknown.password)
    await loginPage.expectFormError(AUTH_MESSAGES.invalidCredentials)

    await loginPage.submitCredentials(USERS.valid.email, WRONG_PASSWORD)
    await loginPage.expectFormError(AUTH_MESSAGES.invalidCredentials)
  })

  test('conta desativada recebe mensagem específica', async ({ loginPage }) => {
    await loginPage.loginAsExpectingFailure(USERS.disabled)

    await loginPage.expectFormError(AUTH_MESSAGES.accountDisabled)
  })

  test('campos obrigatórios bloqueiam o envio', async ({ loginPage, page }) => {
    await loginPage.submitEmpty()

    await loginPage.expectFieldError('email', AUTH_MESSAGES.requiredEmail)
    await loginPage.expectFieldError('password', AUTH_MESSAGES.requiredPassword)
    await expect(page).toHaveURL(new RegExp(ROUTES.login))
  })

  test('e-mail em formato inválido é rejeitado antes de chamar o serviço', async ({
    loginPage,
  }) => {
    await loginPage.submitCredentials('email-sem-arroba', USERS.valid.password)

    await loginPage.expectFieldError('email', AUTH_MESSAGES.invalidEmail)
  })

  test('erro do campo desaparece ao corrigir', async ({ loginPage }) => {
    await loginPage.submitEmpty()
    await loginPage.expectFieldError('email', AUTH_MESSAGES.requiredEmail)

    await loginPage.fillEmail(USERS.valid.email)

    await loginPage.expectNoFieldError('email')
  })

  test(
    'logout encerra a sessão e protege as rotas',
    { tag: '@critical' },
    async ({ loginPage, dashboardPage, page }) => {
      await loginPage.loginAs(USERS.valid)
      await dashboardPage.expectToBeCurrentPage()

      await dashboardPage.header.logout()

      await expect(page).toHaveURL(new RegExp(ROUTES.login))

      // Voltar à rota protegida depois de sair não pode devolver acesso.
      await page.goto(ROUTES.dashboard)
      await expect(page).toHaveURL(new RegExp(ROUTES.login))
    },
  )

  test('sessão sobrevive ao recarregar a página', async ({ loginPage, dashboardPage, page }) => {
    await loginPage.loginAs(USERS.valid)
    await dashboardPage.expectToBeCurrentPage()

    await page.reload()

    await dashboardPage.expectGreeting(USERS.valid.name)
  })
})
