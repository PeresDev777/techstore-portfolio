import { PRODUCTS } from '@data/products'
import { OrderFactory } from '@factories/OrderFactory'
import { ProductFactory } from '@factories/ProductFactory'
import { expect, test } from '@fixtures/api'
import { CartService } from '@services/CartService'
import { OrderService } from '@services/OrderService'
import { ProductService } from '@services/ProductService'
import { ERROR_CODE } from '@services/types'
import { expectError, expectSuccess } from '@utils/assertions'

/**
 * Pedidos.
 *
 * Nenhum cenario aqui tem tela: o frontend nao tem historico de pedidos nem area
 * administrativa. Sao todos inalcancaveis pelo navegador — e por isso mesmo sao onde vive
 * o risco de negocio mais alto do sistema: dinheiro, estoque e concorrencia.
 */
test.describe('API — pedidos', () => {
  test('o pedido nasce do carrinho, e o corpo nao decide preco', async ({ cart, orders }) => {
    expectSuccess(await cart.addItem(PRODUCTS.mouse.id, 2), 201)

    const pedido = expectSuccess(await orders.create(OrderFactory.build()), 201)

    expect(pedido.status).toBe('PENDING')
    expect(pedido.id).toMatch(/^TS-[0-9A-F]{6}$/)
    expect(pedido.items).toHaveLength(1)
    expect(pedido.items[0]?.unitPrice).toBe(PRODUCTS.mouse.price)
    expect(pedido.totals.subtotal).toBe(PRODUCTS.mouse.price * 2)

    /* O carrinho e consumido pela transacao — nao sobra estado para o proximo pedido. */
    const carrinho = expectSuccess(await cart.get())
    expect(carrinho.items).toHaveLength(0)
  })

  test('o corpo nao pode injetar total nem status', async ({ cart, orders }) => {
    /*
     * Se o cliente pudesse enviar itens ou totais, enviaria tambem o preco — e um pedido de
     * R$ 0,01 seria aceito. O `forbidNonWhitelisted` recusa o campo em vez de ignora-lo, o
     * que e a diferenca entre o atacante saber que falhou e achar que funcionou.
     */
    expectSuccess(await cart.addItem(PRODUCTS.mouse.id, 1), 201)

    expectError(await orders.create(OrderFactory.invalid.extraField()), 422, ERROR_CODE.VALIDATION)
  })

  test('carrinho vazio nao fecha pedido', async ({ orders }) => {
    expectError(await orders.create(OrderFactory.build()), 409, ERROR_CODE.CONFLICT)
  })

  test(
    'o snapshot do pedido nao muda quando o catalogo reajusta o preco',
    { tag: '@critical' },
    async ({ asAdmin, asCustomer }) => {
      /*
       * Sem o snapshot (ADR-026), reajustar um preco em 2027 reescreveria o historico de
       * 2026 — problema contabil, nao bug de software.
       *
       * Duplamente inalcancavel pelo navegador: exige `PATCH /products` (sem UI
       * administrativa) e `GET /orders/:id` (sem tela de pedidos).
       *
       * O produto e CRIADO pelo teste em vez de reutilizar o seed: mexer no preco de
       * `prd-008` contaminaria a massa de contrato de que os 79 cenarios E2E dependem.
       */
      const admin = new ProductService(asAdmin)
      const precoOriginal = 150000

      const produto = expectSuccess(
        await admin.create(ProductFactory.build({ priceInCents: precoOriginal, stock: 5 })),
        201,
      )

      await new CartService(asCustomer).addItem(produto.id, 2)
      const pedido = expectSuccess(
        await new OrderService(asCustomer).create(OrderFactory.build()),
        201,
      )

      expect(pedido.items[0]?.unitPrice).toBe(precoOriginal)

      /* Reajuste de 50% no catalogo. */
      const reajustado = expectSuccess(await admin.update(produto.id, { priceInCents: 225000 }))
      expect(reajustado.price).toBe(225000)

      /* O pedido ja fechado continua contando a historia de quando foi fechado. */
      const relido = expectSuccess(await new OrderService(asCustomer).findOne(pedido.id))

      expect(relido.items[0]?.unitPrice).toBe(precoOriginal)
      expect(relido.totals.subtotal).toBe(precoOriginal * 2)
      expect(relido.totals.total).toBe(pedido.totals.total)
    },
  )

  test('pedido de outro usuario responde 404, nunca 403', async ({
    cart,
    orders,
    asOtherCustomer,
  }) => {
    /*
     * 403 confirmaria que o numero existe, e a resposta viraria um oraculo para enumerar
     * pedidos alheios. 404 nao distingue "nao e seu" de "nao existe" — que e exatamente a
     * informacao que nao deve vazar.
     */
    await cart.addItem(PRODUCTS.mouse.id, 1)
    const meu = expectSuccess(await orders.create(OrderFactory.build()), 201)

    const outro = new OrderService(asOtherCustomer)

    expectError(await outro.findOne(meu.id), 404, ERROR_CODE.NOT_FOUND)
    expectError(await outro.cancel(meu.id), 404, ERROR_CODE.NOT_FOUND)
    expectError(await outro.pay(meu.id), 404, ERROR_CODE.NOT_FOUND)

    /* E o historico de cada um so contem os proprios pedidos. */
    const historicoAlheio = expectSuccess(await outro.list())
    expect(historicoAlheio).toHaveLength(0)
  })

  test('ciclo de vida: PENDING paga, e pago nao cancela', async ({ cart, orders }) => {
    await cart.addItem(PRODUCTS.mouse.id, 1)
    const pedido = expectSuccess(await orders.create(OrderFactory.build()), 201)

    const pago = expectSuccess(await orders.pay(pedido.id))
    expect(pago.status).toBe('PAID')

    /*
     * Estorno envolve o meio de pagamento, que nao existe neste projeto. Recusar e mais
     * honesto que fingir que o dinheiro voltou (ADR-040).
     */
    expectError(await orders.cancel(pedido.id), 409, ERROR_CODE.CONFLICT)

    /* Pagar de novo tambem e conflito de estado, nao uma operacao idempotente. */
    expectError(await orders.pay(pedido.id), 409, ERROR_CODE.CONFLICT)
  })

  test('cancelar um PENDING devolve o estoque', async ({ cart, orders, products }) => {
    const antes = expectSuccess(await products.findOne(PRODUCTS.mouse.id)).stock

    await cart.addItem(PRODUCTS.mouse.id, 3)
    const pedido = expectSuccess(await orders.create(OrderFactory.build()), 201)

    expect(expectSuccess(await products.findOne(PRODUCTS.mouse.id)).stock).toBe(antes - 3)

    const cancelado = expectSuccess(await orders.cancel(pedido.id))
    expect(cancelado.status).toBe('CANCELED')

    expect(expectSuccess(await products.findOne(PRODUCTS.mouse.id)).stock).toBe(antes)
  })

  test(
    'dois pedidos simultaneos para a ultima unidade: um 201, um 409, estoque nunca negativo',
    { tag: ['@critical', '@slow'] },
    async ({ asAdmin, asCustomer, asOtherCustomer, products }) => {
      /*
       * O bug classico de e-commerce, e o cenario que MOTIVOU o ADR-038.
       *
       * A alternativa ingenua — ler o estoque, comparar em JavaScript, gravar — deixa uma
       * janela entre a leitura e a escrita. Teste manual nunca pega: exige duas requisicoes
       * no mesmo milissegundo. O navegador tambem nao: nao ha como clicar duas vezes em
       * dois navegadores com essa precisao.
       *
       * O ADR-038 registra que isso foi verificado empiricamente UMA VEZ, a mao, durante a
       * Sprint 6 da API. A partir daqui e um teste.
       *
       * Estoque 1 nao existe no seed, e baixar o de um produto do seed quebraria os
       * cenarios E2E que asseveram os valores de contrato — por isso o produto e criado.
       */
      const produto = expectSuccess(
        await new ProductService(asAdmin).create(ProductFactory.withStock(1)),
        201,
      )

      /* Os dois usuarios reservam a mesma unica unidade: o carrinho e so um rascunho. */
      await new CartService(asCustomer).addItem(produto.id, 1)
      await new CartService(asOtherCustomer).addItem(produto.id, 1)

      /*
       * `Promise.all` dispara as duas sem aguardar a primeira. E o mais proximo de
       * simultaneo que um cliente consegue produzir — e o suficiente, porque a corrida que
       * importa acontece dentro da transacao do Postgres.
       */
      const [um, dois] = await Promise.all([
        new OrderService(asCustomer).create(OrderFactory.build()),
        new OrderService(asOtherCustomer).create(OrderFactory.build()),
      ])

      const status = [um.status, dois.status].sort((a, b) => a - b)

      expect(status, 'exatamente um pedido deve vencer a disputa').toEqual([201, 409])

      /*
       * Qual das duas requisicoes perde e indeterminado por natureza — e o ponto do teste.
       * Filtrar em vez de ramificar expressa isso sem um `if` no corpo, que o lint acusa e
       * que aqui esconderia a assercao atras de um caminho que pode nao executar.
       */
      for (const recusado of [um, dois].filter((resposta) => !resposta.ok)) {
        expectError(recusado, 409, ERROR_CODE.INSUFFICIENT_STOCK)
      }

      /*
       * A assercao que fecha o caso. Sem a guarda condicional no proprio UPDATE, os dois
       * pedidos passariam e o estoque terminaria em -1 — um produto vendido duas vezes.
       */
      const final = expectSuccess(await products.findOne(produto.id))
      expect(final.stock, 'estoque nao pode ficar negativo').toBe(0)
    },
  )
})
