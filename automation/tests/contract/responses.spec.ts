import { PRODUCTS } from '@data/products'
import { OrderFactory } from '@factories/OrderFactory'
import { ProductFactory } from '@factories/ProductFactory'
import { expect, test } from '@fixtures/contract'
import type { ResponseRef } from '@schemas/contract'
import { ProductService } from '@services/ProductService'
import { expectMatchesSpec } from '@utils/assertions'

/**
 * Teste de contrato: a resposta real bate com a especificacao publicada.
 *
 * **Onde este nivel pega o que os outros dois deixam passar.** Um teste de API assevera
 * NUMEROS: o total do pedido, o estoque que sobrou, o `code` do erro. Um teste E2E assevera
 * o que o usuario ve. Nenhum dos dois olha para a FORMA declarada — e foi exatamente ali
 * que a API ja errou uma vez: o ADR-044 registra que as 64 respostas da spec declaravam o
 * formato SEM envelope enquanto toda resposta em runtime vinha COM. Nenhum teste falhava.
 * Quem gerasse um cliente tipado a partir de `/api/docs-json` receberia codigo quebrado, e
 * descobriria em producao.
 *
 * O ADR-044 pediu este arquivo por escrito, como "candidato natural para o projeto de QA
 * Automation".
 */

test.describe('Contrato — respostas de sucesso', () => {
  test('catalogo paginado', async ({ contract, products }) => {
    const response = await products.list({ page: 1, limit: 5 })

    expect(response.status).toBe(200)
    expectMatchesSpec(contract, { path: '/api/v1/products', method: 'get', status: 200 }, response)
  })

  test('produto por identificador', async ({ contract, products }) => {
    const response = await products.findOne(PRODUCTS.mouse.id)

    expectMatchesSpec(
      contract,
      { path: '/api/v1/products/{identifier}', method: 'get', status: 200 },
      response,
    )
  })

  test('relacionados', async ({ contract, products }) => {
    const response = await products.related(PRODUCTS.mouse.id)

    expectMatchesSpec(
      contract,
      { path: '/api/v1/products/{identifier}/related', method: 'get', status: 200 },
      response,
    )
  })

  test('categorias', async ({ contract, api }) => {
    const response = await api.get('/categories')

    expectMatchesSpec(
      contract,
      { path: '/api/v1/categories', method: 'get', status: 200 },
      response,
    )
  })

  test('sessao aberta pelo login', async ({ contract, auth }) => {
    const response = await auth.login({ email: 'qa@techstore.com', password: 'Test@1234' })

    expectMatchesSpec(
      contract,
      { path: '/api/v1/auth/login', method: 'post', status: 200 },
      response,
    )
  })

  test('usuario da sessao', async ({ contract, asCustomer }) => {
    const response = await asCustomer.get('/auth/me')

    expectMatchesSpec(contract, { path: '/api/v1/auth/me', method: 'get', status: 200 }, response)
  })

  test('carrinho vazio e carrinho com itens', async ({ contract, cart }) => {
    const ref: ResponseRef = { path: '/api/v1/cart', method: 'get', status: 200 }

    /*
     * As duas formas importam: um schema que so foi exercitado com a lista cheia nao prova
     * nada sobre o carrinho vazio, onde os totais sao zero e `items` e uma lista sem
     * elementos — o estado em que um `null` indevido passaria despercebido.
     */
    expectMatchesSpec(contract, ref, await cart.get())

    await cart.addItem(PRODUCTS.mouse.id, 2)

    expectMatchesSpec(contract, ref, await cart.get())
  })

  test('item adicionado ao carrinho', async ({ contract, cart }) => {
    const response = await cart.addItem(PRODUCTS.mouse.id, 1)

    expectMatchesSpec(
      contract,
      { path: '/api/v1/cart/items', method: 'post', status: 201 },
      response,
    )
  })

  test('pedido criado, listado e recuperado', async ({ contract, cart, orders }) => {
    await cart.addItem(PRODUCTS.mouse.id, 2)

    const criado = await orders.create(OrderFactory.build())
    expectMatchesSpec(contract, { path: '/api/v1/orders', method: 'post', status: 201 }, criado)

    expectMatchesSpec(
      contract,
      { path: '/api/v1/orders', method: 'get', status: 200 },
      await orders.list(),
    )

    const id = (criado.body as { data: { id: string } }).data.id

    expectMatchesSpec(
      contract,
      { path: '/api/v1/orders/{id}', method: 'get', status: 200 },
      await orders.findOne(id),
    )
  })

  test('pedido cancelado carrega canceledAt preenchido', async ({ contract, cart, orders }) => {
    /*
     * `canceledAt` e o unico campo `nullable` que a suite exercita nos DOIS estados. E o
     * caso que prova a conversao de `nullable: true` para uniao de tipos: sem ela, o pedido
     * NAO cancelado — com `canceledAt: null` — reprovaria contra um schema que declara
     * `string`, e o teste acusaria a API de quebrar um contrato que ela cumpre.
     */
    await cart.addItem(PRODUCTS.mouse.id, 1)
    const criado = await orders.create(OrderFactory.build())
    const id = (criado.body as { data: { id: string } }).data.id

    expect((criado.body as { data: { canceledAt: string | null } }).data.canceledAt).toBeNull()

    const cancelado = await orders.cancel(id)

    expectMatchesSpec(
      contract,
      { path: '/api/v1/orders/{id}/cancel', method: 'post', status: 200 },
      cancelado,
    )
    expect(
      (cancelado.body as { data: { canceledAt: string | null } }).data.canceledAt,
    ).not.toBeNull()
  })

  test('listagem administrativa de usuarios', async ({ contract, asAdmin }) => {
    const response = await asAdmin.get('/users', { query: { page: 1, limit: 10 } })

    expectMatchesSpec(contract, { path: '/api/v1/users', method: 'get', status: 200 }, response)
  })

  test('produto criado pelo administrador', async ({ contract, asAdmin }) => {
    const response = await new ProductService(asAdmin).create(ProductFactory.build())

    expectMatchesSpec(contract, { path: '/api/v1/products', method: 'post', status: 201 }, response)
  })
})

test.describe('Contrato — respostas de erro', () => {
  /*
   * O envelope de erro tem forma propria — `code` e `errors[]` no lugar de `data` — e um
   * cliente decide COMPORTAMENTO por ele (ADR-023). Uma spec que descrevesse o erro errado
   * levaria o cliente a tratar o caso errado, e nenhum teste funcional perceberia: o status
   * e o `code` continuariam certos.
   */
  test('401 sem token', async ({ contract, api }) => {
    expectMatchesSpec(
      contract,
      { path: '/api/v1/cart', method: 'get', status: 401 },
      await api.get('/cart'),
    )
  })

  test('403 em rota administrativa', async ({ contract, asCustomer }) => {
    expectMatchesSpec(
      contract,
      { path: '/api/v1/users', method: 'get', status: 403 },
      await asCustomer.get('/users'),
    )
  })

  test('404 de produto inexistente', async ({ contract, products }) => {
    expectMatchesSpec(
      contract,
      { path: '/api/v1/products/{identifier}', method: 'get', status: 404 },
      await products.findOne('prd-nao-existe'),
    )
  })

  test('409 por estoque insuficiente', async ({ contract, cart }) => {
    expectMatchesSpec(
      contract,
      { path: '/api/v1/cart/items', method: 'post', status: 409 },
      await cart.addItem(PRODUCTS.outOfStock.id, 1),
    )
  })

  test('422 com errors[] preenchido', async ({ contract, cart, orders }) => {
    await cart.addItem(PRODUCTS.mouse.id, 1)

    const response = await orders.create(OrderFactory.invalid.cpf())

    expectMatchesSpec(contract, { path: '/api/v1/orders', method: 'post', status: 422 }, response)
  })

  test('422 por parametro de consulta invalido', async ({ contract, products }) => {
    expectMatchesSpec(
      contract,
      { path: '/api/v1/products', method: 'get', status: 422 },
      await products.list({ sort: 'nao-existe' }),
    )
  })
})
