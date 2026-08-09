import { PRODUCTS } from '@data/products'
import { ProductFactory } from '@factories/ProductFactory'
import { expect, test } from '@fixtures/api'
import { CartService } from '@services/CartService'
import { ProductService } from '@services/ProductService'
import { ERROR_CODE } from '@services/types'
import { expectError, expectSuccess } from '@utils/assertions'

/**
 * Carrinho.
 *
 * Os 14 cenarios E2E ja cobrem o que o usuario ve: badge, totais, frete gratis, limite de
 * quantidade pelo seletor. Nada disso se repete aqui.
 *
 * O que sobra e o que a UI ESCONDE por desenho. O ADR-037 registra a divergencia
 * deliberada: o frontend faz `clamp` silencioso, a API responde **409**. O seletor de
 * quantidade nunca deixa pedir mais que o estoque, entao o navegador jamais produz a
 * requisicao que dispara o conflito — e um cliente que nao seja aquele navegador (app,
 * script, integracao) encontra o 409 em producao, num caminho que nenhum teste percorreu.
 *
 * "A UI protege o usuario; a API informa o cliente."
 */
test.describe('API — carrinho', () => {
  test('produto repetido soma a quantidade em vez de criar segunda linha', async ({ cart }) => {
    expectSuccess(await cart.addItem(PRODUCTS.mouse.id, 2), 201)
    const depois = expectSuccess(await cart.addItem(PRODUCTS.mouse.id, 3), 201)

    expect(depois.items).toHaveLength(1)
    expect(depois.items[0]?.quantity).toBe(5)
    expect(depois.totals.lineCount).toBe(1)
    expect(depois.totals.itemCount).toBe(5)
  })

  test(
    'o limite de estoque vale sobre a SOMA, e o excesso responde 409',
    { tag: '@critical' },
    async ({ cart }) => {
      /*
       * O caso do ADR-037, com os numeros dele: `prd-004` tem estoque 3.
       * 2 no carrinho + 3 pedidos = 5 > 3 -> 409.
       *
       * Aplicar o limite sobre a PARCELA em vez da soma e o defeito classico: cada
       * requisicao pareceria valida isoladamente e o carrinho acumularia acima do estoque.
       */
      expectSuccess(await cart.addItem(PRODUCTS.premiumLaptop.id, 2), 201)

      const excesso = await cart.addItem(PRODUCTS.premiumLaptop.id, 3)

      expectError(excesso, 409, ERROR_CODE.INSUFFICIENT_STOCK)

      /* O carrinho nao foi alterado pela tentativa recusada. */
      const carrinho = expectSuccess(await cart.get())
      expect(carrinho.items[0]?.quantity).toBe(2)
    },
  )

  test('produto esgotado nao entra no carrinho', async ({ cart }) => {
    expectError(await cart.addItem(PRODUCTS.outOfStock.id, 1), 409, ERROR_CODE.INSUFFICIENT_STOCK)
  })

  test('quantidade zero no PATCH e recusada — existe DELETE para isso', async ({ cart }) => {
    /*
     * Aceitar zero criaria dois caminhos para remover e um verbo mentiroso: um update que
     * apaga o recurso que deveria atualizar. A UI nunca envia zero (o botao de diminuir
     * desabilita em 1), entao so HTTP alcanca este caminho.
     */
    await cart.addItem(PRODUCTS.mouse.id, 2)

    expectError(await cart.updateItem(PRODUCTS.mouse.id, 0), 422, ERROR_CODE.VALIDATION)
  })

  test('o PATCH define quantidade ABSOLUTA, nao incremento', async ({ cart }) => {
    /*
     * A UI so faz +1 e -1, entao a diferenca entre absoluto e incremento e invisivel nela.
     * Um cliente que assumisse incremento gravaria 7 onde queria 5.
     */
    await cart.addItem(PRODUCTS.mouse.id, 2)

    const atualizado = expectSuccess(await cart.updateItem(PRODUCTS.mouse.id, 5))

    expect(atualizado.items[0]?.quantity).toBe(5)
  })

  test('atualizar acima do estoque responde 409', async ({ cart }) => {
    await cart.addItem(PRODUCTS.premiumLaptop.id, 1)

    expectError(
      await cart.updateItem(PRODUCTS.premiumLaptop.id, PRODUCTS.premiumLaptop.stock + 1),
      409,
      ERROR_CODE.INSUFFICIENT_STOCK,
    )
  })

  test('produto inexistente responde 404', async ({ cart }) => {
    expectError(await cart.addItem('prd-nao-existe', 1), 404, ERROR_CODE.NOT_FOUND)
  })

  test('item que sai de catalogo continua visivel, mas fora dos totais', async ({
    asAdmin,
    asCustomer,
  }) => {
    /*
     * Um carrinho fica parado por dias e o catalogo nao para.
     *
     * Impossivel de reproduzir pelo navegador: exige `DELETE /products/:id` como
     * administrador ENQUANTO outro usuario tem o item no carrinho, e nao existe tela
     * administrativa. E o cenario que o ADR-037 descreve e que ninguem tinha exercitado.
     *
     * Somar o que nao da para comprar produziria um total que o checkout nunca cobraria, e
     * o usuario veria numeros diferentes em duas telas sem entender por que.
     */
    const admin = new ProductService(asAdmin)
    const carrinho = new CartService(asCustomer)

    const produto = expectSuccess(await admin.create(ProductFactory.withStock(5)), 201)

    await carrinho.addItem(produto.id, 2)
    await carrinho.addItem(PRODUCTS.mouse.id, 1)

    const comAmbos = expectSuccess(await carrinho.get())
    expect(comAmbos.totals.subtotal).toBe(produto.price * 2 + PRODUCTS.mouse.price)

    /* O produto sai de catalogo depois de ja estar no carrinho. */
    expectSuccess(await admin.remove(produto.id))

    const depois = expectSuccess(await carrinho.get())

    const indisponivel = depois.items.find((item) => item.product.id === produto.id)
    expect(indisponivel, 'o item precisa continuar VISIVEL').toBeDefined()
    expect(indisponivel?.unavailable).toBe(true)
    expect(indisponivel?.unavailableReason).toEqual(expect.any(String))

    /* E o total passa a refletir apenas o que da para comprar. */
    expect(depois.totals.subtotal).toBe(PRODUCTS.mouse.price)
  })

  test('o carrinho e sempre o de quem apresenta o token', async ({
    asCustomer,
    asOtherCustomer,
  }) => {
    /*
     * O isolamento aqui e ESTRUTURAL: nenhuma rota recebe id de carrinho ou de usuario, e
     * portanto nao ha parametro para adulterar. O E2E prova o isolamento entre sessoes de
     * navegador; este prova que dois TOKENS distintos veem carrinhos distintos, que e o
     * mecanismo real por tras.
     */
    await new CartService(asCustomer).addItem(PRODUCTS.mouse.id, 2)

    const alheio = expectSuccess(await new CartService(asOtherCustomer).get())

    expect(alheio.items).toHaveLength(0)
    expect(alheio.totals.subtotal).toBe(0)
  })
})
