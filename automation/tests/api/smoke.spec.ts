import { CATALOG_SIZE } from '@data/products'
import { USERS } from '@data/users'
import { test } from '@fixtures/api'
import { UserService } from '@services/UserService'
import { ERROR_CODE } from '@services/types'
import { expect } from '@playwright/test'
import { expectError, expectPaginated, expectRequestIdEcho, expectSuccess } from '@utils/assertions'

/**
 * Smoke da API.
 *
 * Nenhum destes cenarios recobre o que os 79 E2E ja cobrem — cada um verifica algo que o
 * navegador nao alcanca ou que ele so alcanca por acidente. Sao tambem o exercicio de toda
 * a camada montada na Sprint 2: cliente HTTP, tokens por papel, services e o helper unico
 * de assercao.
 */
test.describe('API — smoke', { tag: '@smoke' }, () => {
  test('rota protegida sem token responde 401', async ({ api }) => {
    /*
     * A API e fechada por padrao (ADR-032): `@Public()` e a unica forma de escapar. Este
     * teste e a rede de seguranca dessa decisao — esquecer o decorator numa rota privada
     * produz um endpoint aberto que ninguem percebe ate alguem de fora perceber.
     */
    const response = await api.get('/cart')

    expectError(response, 401, ERROR_CODE.UNAUTHENTICATED)
  })

  test('token valido identifica o usuario da sessao', async ({ asCustomer }) => {
    const response = await asCustomer.get<{ id: string; email: string; role: string }>('/auth/me')
    const user = expectSuccess(response)

    expect(user.id).toBe(USERS.valid.id)
    expect(user.email).toBe(USERS.valid.email)
    expect(user.role).toBe('CUSTOMER')
  })

  test('cliente em rota de administrador responde 403', async ({ asCustomer }) => {
    /*
     * Impossivel pelo navegador: o frontend nao tem nenhuma tela administrativa, entao nao
     * existe caminho de UI para esta rota. 403 e nao 401 — a API sabe quem e, e essa pessoa
     * nao pode. Um cliente que tratasse 401 renovando o token entraria em laco infinito.
     */
    const response = await new UserService(asCustomer).list()

    expectError(response, 403, ERROR_CODE.FORBIDDEN)
  })

  test('administrador lista usuarios com paginacao consistente', async ({ asAdmin }) => {
    const response = await new UserService(asAdmin).list({ page: 1, limit: 10 })
    const { data, pagination } = expectPaginated(response, { page: 1, limit: 10 })

    /* O seed tem 4 usuarios (ADR-028). E contrato, nao coincidencia. */
    expect(pagination.total).toBe(4)
    expect(data).toHaveLength(4)

    /* Nenhuma resposta de usuario pode carregar hash de senha. */
    for (const user of data) {
      expect(Object.keys(user)).not.toContain('password')
      expect(Object.keys(user)).not.toContain('passwordHash')
    }
  })

  test('catalogo responde paginado com o total do seed', async ({ products }) => {
    const response = await products.list({ limit: 100 })
    const { data } = expectPaginated(response, { total: CATALOG_SIZE })

    expect(data).toHaveLength(CATALOG_SIZE)
  })

  test('a API ecoa o x-request-id enviado', async ({ api }) => {
    /*
     * A correlacao prometida pelo ADR-031. Sem ela, um teste vermelho no CI diz "algo deu
     * errado"; com ela, o log da API entrega a requisicao exata com um grep. Todo o valor
     * das evidencias da suite de API depende deste comportamento continuar existindo.
     */
    const response = await api.get('/products', { query: { limit: 1 } })

    expectSuccess(response)
    expectRequestIdEcho(response)
  })
})
