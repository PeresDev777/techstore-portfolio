import { test as base } from '@playwright/test'

import { USERS } from '@data/users'
import { ApiClient } from '@services/ApiClient'
import { AuthService } from '@services/AuthService'
import { CartService } from '@services/CartService'
import { OrderService } from '@services/OrderService'
import { ProductService } from '@services/ProductService'
import { UserService } from '@services/UserService'
import { resetDatabase } from '@utils/api'

/**
 * Fixtures da suite de API.
 *
 * Arquivo separado de `fixtures/test.ts` de proposito: aquele instancia oito Page Objects,
 * que arrastam `page` e, com ele, um navegador. Um teste de API que importasse dali pagaria
 * a subida de um Chromium para nao abrir uma tela.
 */

interface ServerState {
  freshDatabase: void
}

interface Clients {
  /** Cliente SEM credencial. Prova que uma rota exige autenticacao. */
  api: ApiClient
  /** Autenticado como `qa@techstore.com` (usr-001). O padrao dos cenarios. */
  asCustomer: ApiClient
  /** Autenticado como `ana.souza@techstore.com` (usr-002). Isolamento entre contas. */
  asOtherCustomer: ApiClient
  /** Autenticado como `admin@techstore.com` (usr-004). Rotas restritas. */
  asAdmin: ApiClient
  /** Sessao completa do cliente padrao — quem precisa do refreshToken pede isto. */
  customerSession: { accessToken: string; refreshToken: string }
}

interface Services {
  auth: AuthService
  products: ProductService
  cart: CartService
  orders: OrderService
  users: UserService
}

export const test = base.extend<ServerState & Clients & Services>({
  /*
   * Estado do servidor, reiniciado antes de CADA teste — mesma decisao da suite E2E
   * (ADR-047), e aqui ela pesa ainda mais: um teste de API cria pedidos e baixa estoque em
   * uma requisicao, sem nenhuma tela para dar pista de que o estado mudou.
   *
   * `auto: true` porque um teste que esquecesse de pedir o reset falharia conforme a ordem
   * de execucao — o pior tipo de falha, porque parece flakiness e nao e.
   */
  freshDatabase: [
    async ({ request }, use) => {
      await resetDatabase(request)
      await use()
    },
    { auto: true },
  ],

  /*
   * Cliente base e ponto de coleta das evidencias.
   *
   * O `calls` e criado aqui e compartilhado por todos os clientes derivados: a evidencia
   * pertence ao TESTE, nao a cada cliente. Um teste de autorizacao que usa `asCustomer` e
   * `asAdmin` precisa mostrar as duas chamadas no mesmo relatorio.
   */
  api: async ({ request }, use, testInfo) => {
    const client = new ApiClient(request)

    await use(client)

    /*
     * Screenshot e video nao existem sem navegador (ADR-019 nao serve a esta suite). A
     * moeda de evidencia aqui e o par requisicao/resposta com o `x-request-id` — que a API
     * ecoa (ADR-031) e que encontra a linha exata do log com um grep.
     *
     * Anexado so na falha, pelo mesmo motivo da politica de screenshot: execucao verde nao
     * precisa de prova e artifact inflado ninguem abre.
     */
    if (testInfo.status !== testInfo.expectedStatus && client.calls.length > 0) {
      await testInfo.attach('requisicoes', {
        body: JSON.stringify(client.calls, null, 2),
        contentType: 'application/json',
      })

      const resumo = client.calls
        .map((c) => `${c.method} ${c.url} -> ${c.status} (${c.durationMs}ms) [${c.requestId}]`)
        .join('\n')

      await testInfo.attach('resumo-http.txt', { body: resumo, contentType: 'text/plain' })
    }
  },

  customerSession: async ({ api, freshDatabase }, use) => {
    void freshDatabase // dependencia explicita: autenticar antes do reset perderia o refresh
    const session = await new AuthService(api).authenticate(USERS.valid)

    await use({ accessToken: session.accessToken, refreshToken: session.refreshToken })
  },

  asCustomer: async ({ api, customerSession }, use) => {
    await use(api.withToken(customerSession.accessToken))
  },

  asOtherCustomer: async ({ api, freshDatabase }, use) => {
    void freshDatabase
    const session = await new AuthService(api).authenticate(USERS.secondary)

    await use(api.withToken(session.accessToken))
  },

  asAdmin: async ({ api, freshDatabase }, use) => {
    void freshDatabase
    const session = await new AuthService(api).authenticate(USERS.admin)

    await use(api.withToken(session.accessToken))
  },

  /*
   * Services ja ligados ao cliente do usuario padrao — o caso de longe mais comum.
   *
   * Quem precisa de outro papel constroi na hora: `new UserService(asAdmin)`. Expor uma
   * fixture por combinacao de service e papel multiplicaria quinze fixtures para economizar
   * uma linha, e ainda esconderia no nome qual token esta em uso — que e justamente o que
   * um teste de autorizacao precisa deixar explicito.
   */
  auth: async ({ api }, use) => {
    await use(new AuthService(api))
  },

  products: async ({ api }, use) => {
    await use(new ProductService(api))
  },

  cart: async ({ asCustomer }, use) => {
    await use(new CartService(asCustomer))
  },

  orders: async ({ asCustomer }, use) => {
    await use(new OrderService(asCustomer))
  },

  users: async ({ asCustomer }, use) => {
    await use(new UserService(asCustomer))
  },
})

export { expect } from '@playwright/test'
