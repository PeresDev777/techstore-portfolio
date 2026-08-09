import { USERS } from '@data/users'
import { expect, test } from '@fixtures/anonymous'
import { ROUTES } from '@utils/routes'

/**
 * Sessao expirada, do ponto de vista do NAVEGADOR.
 *
 * **A decomposicao importa mais que os testes.** "Sessao expirada" parece um cenario e sao
 * dois, em niveis diferentes:
 *
 * | Pergunta | Onde vive |
 * | --- | --- |
 * | O access token de fato expira e o refresh rotaciona? | `tests/api/auth.spec.ts` |
 * | O que a APLICACAO faz quando recebe 401? | aqui |
 *
 * A tentacao era subir a API com `JWT_ACCESS_TTL_SECONDS=2` e esperar. Isso contamina: um
 * TTL curto na instancia compartilhada faria os outros 79 cenarios oscilarem, e uma segunda
 * instancia so para isto custa complexidade no CI. Pior, o teste passaria a DORMIR — e
 * espera por relogio e a origem mais comum de suite intermitente.
 *
 * Interceptando a rota, a pergunta do navegador fica exata e deterministica: nao e "o JWT
 * expira?", e "o cliente renova sozinho, e o que acontece quando nem isso funciona?".
 *
 * Os dois cenarios exercitam o `refreshOnce` do `http.ts` — a renovacao em voo
 * compartilhada, que existe para nao disparar o detector de reuso da propria API.
 */
test.describe('Sessao expirada', () => {
  test.beforeEach(async ({ loginPage, dashboardPage }) => {
    /*
     * Login pela UI, e nao pelo `storageState`, por uma razao concreta: a fixture de reset
     * TRUNCA a tabela de sessoes antes de cada teste, entao o refresh token gravado no
     * estado do navegador ja nasce invalido (documentado em `api/README.md`). Autenticar
     * aqui produz um par de tokens que o servidor de fato reconhece — sem isso, o cenario
     * de renovacao bem-sucedida seria impossivel de montar.
     */
    await loginPage.open()
    await loginPage.loginAs(USERS.valid)
    await dashboardPage.expectToBeCurrentPage()
  })

  test('access token vencido e renovado sem o usuario perceber', async ({
    page,
    dashboardPage,
  }) => {
    /*
     * Um unico 401, como um access token que acabou de vencer. O `/auth/refresh` segue
     * para a API de verdade: o que se testa e a reacao do cliente, entao so o gatilho e
     * simulado — a renovacao precisa ser real, senao o teste provaria apenas que o
     * intercepta a si mesmo.
     */
    let jaExpirou = false

    await page.route('**/api/v1/auth/me', async (route) => {
      if (jaExpirou) return route.fallback()

      jaExpirou = true

      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Sessão expirada.',
          code: 'UNAUTHENTICATED',
        }),
      })
    })

    await page.reload()

    /* O usuario continua logado: a renovacao aconteceu sem nenhum sinal na tela. */
    await dashboardPage.expectToBeCurrentPage()
    await expect(dashboardPage.greeting).toContainText(USERS.valid.name)
    expect(jaExpirou, 'o 401 precisa ter sido servido, senao o teste nao provou nada').toBe(true)
  })

  test('renovacao recusada encerra a sessao e leva ao login', async ({ page }) => {
    /*
     * O outro lado: o refresh token tambem morreu — expirou, foi revogado por logout, ou a
     * familia inteira caiu por deteccao de reuso (ADR-025). Aqui renovar NAO resolve, e a
     * aplicacao tem que desistir em vez de insistir.
     *
     * O modo de falha que este teste impede e concreto: um cliente que tratasse este 401
     * renovando entraria em laco infinito de requisicoes contra a API.
     */
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Sessão expirada.',
          code: 'UNAUTHENTICATED',
        }),
      }),
    )

    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Sessão inválida.',
          code: 'UNAUTHENTICATED',
        }),
      }),
    )

    await page.reload()

    await expect(page).toHaveURL(new RegExp(ROUTES.login))
  })

  test('a sessao encerrada nao deixa rota protegida acessivel', async ({ page }) => {
    await page.route('**/api/v1/auth/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Sessão expirada.',
          code: 'UNAUTHENTICATED',
        }),
      }),
    )

    /*
     * Navegacao direta com a sessao ja invalida no servidor. Sem a limpeza do lado do
     * cliente, o `localStorage` continuaria com um token que a API recusa e a tela ficaria
     * presa em carregamento — o estado que o ADR-015 descreve como o pior dos tres.
     */
    await page.goto(ROUTES.cart)

    await expect(page).toHaveURL(new RegExp(ROUTES.login))
  })
})
