import { CATALOG_SIZE, IN_STOCK_COUNT, PRODUCTS } from '@data/products'
import { ProductFactory } from '@factories/ProductFactory'
import { expect, test } from '@fixtures/api'
import { ProductService } from '@services/ProductService'
import { ERROR_CODE } from '@services/types'
import { expectError, expectPaginated, expectSuccess } from '@utils/assertions'

/**
 * Catalogo.
 *
 * Busca, filtro e ordenacao ja tem 20 cenarios E2E que os exercitam PELA TELA. Nada disso
 * se repete aqui — o que se testa e o que a UI **nunca envia**.
 *
 * O ADR-045 registra que o frontend descarta a paginacao de proposito: `getProducts`
 * devolve `Product[]` e a tela nao tem controles de pagina. Entao todo o contrato de
 * `page`, `limit` e `totalPages` — incluindo o teto que impede negacao de servico — vive
 * fora do alcance do navegador.
 */
test.describe('API — catalogo', () => {
  test('paginacao divide o catalogo e deriva totalPages', async ({ products }) => {
    const primeira = await products.list({ page: 1, limit: 5 })
    const { data, pagination } = expectPaginated(primeira, { page: 1, limit: 5 })

    expect(data).toHaveLength(5)
    expect(pagination.total).toBe(CATALOG_SIZE)
    /* `expectPaginated` ja confere totalPages = ceil(total/limit); aqui o valor concreto. */
    expect(pagination.totalPages).toBe(3)
  })

  test('paginas nao se sobrepoem — a ordenacao tem desempate estavel', async ({ products }) => {
    /*
     * Sem desempate por `id`, o Postgres pode devolver ordem diferente entre execucoes e o
     * mesmo produto apareceria em duas paginas (ADR-028). E o defeito que passa nove vezes
     * e falha na decima — invisivel numa UI sem paginacao.
     */
    const p1 = expectPaginated(await products.list({ page: 1, limit: 6 })).data
    const p2 = expectPaginated(await products.list({ page: 2, limit: 6 })).data

    const ids = [...p1, ...p2].map((produto) => produto.id)

    expect(new Set(ids).size, 'nenhum produto pode repetir entre paginas').toBe(CATALOG_SIZE)
  })

  test('limit acima do teto e recusado', async ({ products }) => {
    /*
     * `?limit=1000000` seria negacao de servico gratuita: uma requisicao carregaria a tabela
     * inteira em memoria. O teto de 100 e a defesa, e nenhuma tela jamais envia este valor.
     */
    expectError(await products.list({ limit: 1_000_000 }), 422, ERROR_CODE.VALIDATION)
  })

  test('parametros de paginacao invalidos sao recusados', async ({ products }) => {
    expectError(await products.list({ page: 0 }), 422, ERROR_CODE.VALIDATION)
    expectError(await products.list({ limit: 0 }), 422, ERROR_CODE.VALIDATION)
  })

  test('ordenacao invalida responde 422 em vez de cair no padrao', async ({ products }) => {
    /*
     * A UI valida a query string e cai no padrao quando o valor e lixo (ADR-007) — porque a
     * URL e entrada nao confiavel e a tela nao pode quebrar. A API faz o OPOSTO de
     * proposito: recusa, para o cliente saber que pediu algo que nao existe.
     *
     * As duas decisoes estao certas nos seus contextos, e so o teste de API observa a
     * segunda.
     */
    expectError(await products.list({ sort: 'nao-existe' }), 422, ERROR_CODE.VALIDATION)
  })

  test('pagina alem do fim devolve lista vazia, nao erro', async ({ products }) => {
    const { data, pagination } = expectPaginated(await products.list({ page: 99, limit: 10 }))

    expect(data).toHaveLength(0)
    expect(pagination.total).toBe(CATALOG_SIZE)
  })

  test('filtro de estoque bate com a massa de contrato', async ({ products }) => {
    const { pagination } = expectPaginated(await products.list({ inStock: true, limit: 100 }))

    /* 12 no catalogo, 2 esgotados no seed (prd-006 e prd-010). */
    expect(pagination.total).toBe(IN_STOCK_COUNT)
    expect(pagination.total).toBe(CATALOG_SIZE - 2)
  })

  test('o produto resolve por id e por slug para o mesmo recurso', async ({ products }) => {
    /*
     * A rota aceita os dois, e a UI so usa o id. Um cliente que use slug — ou um link
     * compartilhado — depende do segundo caminho funcionar identicamente.
     */
    const porId = expectSuccess(await products.findOne(PRODUCTS.keyboard.id))
    const porSlug = expectSuccess(await products.findOne(PRODUCTS.keyboard.slug))

    expect(porSlug.id).toBe(porId.id)
    expect(porSlug.price).toBe(PRODUCTS.keyboard.price)
  })

  test('produto inexistente responde 404', async ({ products }) => {
    expectError(await products.findOne('prd-nao-existe'), 404, ERROR_CODE.NOT_FOUND)
  })

  test('produto retirado de catalogo some da listagem publica', async ({ asAdmin, products }) => {
    /*
     * Exclusao LOGICA: o produto continua no banco porque pedidos antigos o referenciam.
     * Nenhuma tela administrativa existe, entao so HTTP chega aqui.
     */
    const criado = expectSuccess(
      await new ProductService(asAdmin).create(ProductFactory.build()),
      201,
    )

    const comNovo = expectPaginated(await products.list({ limit: 100 }))
    expect(comNovo.pagination.total).toBe(CATALOG_SIZE + 1)

    expectSuccess(await new ProductService(asAdmin).remove(criado.id))

    const semNovo = expectPaginated(await products.list({ limit: 100 }))
    expect(semNovo.pagination.total).toBe(CATALOG_SIZE)
    expectError(await products.findOne(criado.id), 404, ERROR_CODE.NOT_FOUND)
  })
})

test.describe('API — autorizacao no catalogo', () => {
  test('cliente nao cria, nao edita e nao remove produto', async ({ asCustomer }) => {
    /*
     * As tres rotas restritas, sem nenhum caminho de navegador que as alcance. 403 e nao
     * 401: a API sabe quem e. Um cliente que tratasse 401 renovando o token entraria em
     * laco infinito num erro que renovar nunca resolve.
     */
    const cliente = new ProductService(asCustomer)

    expectError(await cliente.create(ProductFactory.build()), 403, ERROR_CODE.FORBIDDEN)
    expectError(await cliente.update(PRODUCTS.mouse.id, { stock: 999 }), 403, ERROR_CODE.FORBIDDEN)
    expectError(await cliente.remove(PRODUCTS.mouse.id), 403, ERROR_CODE.FORBIDDEN)
  })

  test('anonimo le o catalogo mas nao o modifica', async ({ api }) => {
    const publico = new ProductService(api)

    expectSuccess(await publico.list({ limit: 1 }))
    expectError(await publico.create(ProductFactory.build()), 401, ERROR_CODE.UNAUTHENTICATED)
  })

  test('administrador cria e edita', async ({ asAdmin }) => {
    /*
     * O par positivo dos dois testes acima. Sem ele, a suite provaria apenas que as rotas
     * recusam alguem — nao que funcionam para quem pode.
     */
    const admin = new ProductService(asAdmin)

    const criado = expectSuccess(await admin.create(ProductFactory.build({ stock: 7 })), 201)
    expect(criado.stock).toBe(7)

    const editado = expectSuccess(await admin.update(criado.id, { stock: 3 }))
    expect(editado.stock).toBe(3)
  })
})
