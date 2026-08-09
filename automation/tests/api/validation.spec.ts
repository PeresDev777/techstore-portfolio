import { PRODUCTS } from '@data/products'
import { INVALID_CPF } from '@factories/documents'
import { OrderFactory } from '@factories/OrderFactory'
import { ProductFactory } from '@factories/ProductFactory'
import { expect, test } from '@fixtures/api'
import { ProductService } from '@services/ProductService'
import { ERROR_CODE } from '@services/types'
import { expectError, expectFieldErrors } from '@utils/assertions'

/**
 * Validacao.
 *
 * O E2E ja cobre CPF, CEP e telefone pela tela — sao 14 cenarios em
 * `checkout-validation.spec.ts`. Repetir a REGRA aqui seria desperdicio.
 *
 * A informacao nova neste arquivo nao e "o CPF invalido e recusado": e **`errors[].field`
 * com caminho pontilhado**. A tela mostra a mensagem dela, e o contrato da API — qual campo
 * falhou, em qual profundidade — e invisivel para o navegador. Um cliente que precise
 * destacar o campo errado num formulario proprio depende exatamente disso.
 */
test.describe('API — validacao', () => {
  test.beforeEach(async ({ cart }) => {
    /* Pedido exige carrinho: sem itens a resposta seria 409, nao a validacao que se testa. */
    await cart.addItem(PRODUCTS.mouse.id, 1)
  })

  test('CPF invalido aponta o campo aninhado customer.cpf', async ({ orders }) => {
    const erro = expectFieldErrors(await orders.create(OrderFactory.invalid.cpf()), 'customer.cpf')

    /* A mensagem nao e asseverada — copy muda. O CAMPO e o contrato (ADR-023/024). */
    expect(erro.errors?.length).toBeGreaterThan(0)
  })

  test('CPF de digitos repetidos tambem e recusado', async ({ orders }) => {
    /*
     * Passa na conta dos digitos verificadores e mesmo assim e invalido. E o valor que se
     * digita para furar um formulario — e o motivo de a API validar pelo algoritmo real e
     * nao por comprimento (ADR-013).
     */
    expectFieldErrors(await orders.create(OrderFactory.invalid.repeatedCpf()), 'customer.cpf')
  })

  test('CPF mascarado com digito errado nao passa por limpeza de pontuacao', async ({ orders }) => {
    const pedido = OrderFactory.build()
    pedido.customer.cpf = INVALID_CPF.maskedWrongCheckDigit

    expectFieldErrors(await orders.create(pedido), 'customer.cpf')
  })

  test('campo aninhado ausente e detectado — o @Type() esta aplicado', async ({ orders }) => {
    /*
     * Sem `@Type()` no DTO, o objeto aninhado chega como literal e o class-validator NAO
     * desce nele: a requisicao passaria com o endereco pela metade e o defeito so apareceria
     * na entrega. Este teste e a rede de seguranca dessa anotacao.
     */
    expectFieldErrors(
      await orders.create(OrderFactory.invalid.missingAddressField()),
      'address.zipCode',
    )
  })

  test('UF fora da lista aponta address.state', async ({ orders }) => {
    expectFieldErrors(await orders.create(OrderFactory.invalid.state()), 'address.state')
  })

  test('e-mail invalido aponta customer.email', async ({ orders }) => {
    expectFieldErrors(await orders.create(OrderFactory.invalid.email()), 'customer.email')
  })

  test('varios campos invalidos sao reportados de uma vez', async ({ orders }) => {
    /*
     * Um cliente que so recebesse o PRIMEIRO erro obrigaria o usuario a corrigir o
     * formulario um campo por vez, com uma ida ao servidor entre cada um.
     */
    const pedido = OrderFactory.build()
    pedido.customer.cpf = INVALID_CPF.wrongCheckDigit
    pedido.customer.email = 'nao-e-email'
    pedido.address.state = 'XX'

    expectFieldErrors(
      await orders.create(pedido),
      'customer.cpf',
      'customer.email',
      'address.state',
    )
  })

  test('campo nao declarado no DTO e recusado, nao ignorado', async ({ orders }) => {
    /*
     * Mass assignment. Recusar e diferente de ignorar: ignorar em silencio deixaria o
     * proximo desenvolvedor achar que o campo funciona, e um dia alguem o le da entrada.
     */
    expectError(await orders.create(OrderFactory.invalid.extraField()), 422, ERROR_CODE.VALIDATION)
  })

  test('preco e estoque negativos sao recusados na criacao de produto', async ({ asAdmin }) => {
    const admin = new ProductService(asAdmin)

    expectFieldErrors(await admin.create(ProductFactory.invalid.negativePrice()), 'priceInCents')
    expectFieldErrors(await admin.create(ProductFactory.invalid.negativeStock()), 'stock')
  })

  test('preco fracionario e recusado — dinheiro e inteiro em centavos', async ({ asAdmin }) => {
    /*
     * Aceitar `99.99` abriria a porta para ponto flutuante no dominio monetario, e somas de
     * carrinho deixariam de ser exatas por construcao (ADR-008).
     */
    expectFieldErrors(
      await new ProductService(asAdmin).create(ProductFactory.invalid.fractionalPrice()),
      'priceInCents',
    )
  })

  test('categoria inexistente aponta o campo category com 422, nao 404', async ({ asAdmin }) => {
    /*
     * 404 diria que `/products` nao existe, o que e falso: quem nao existe e um campo do
     * CORPO. O cliente trata pelo mesmo caminho de qualquer erro de preenchimento.
     */
    expectFieldErrors(
      await new ProductService(asAdmin).create(ProductFactory.invalid.unknownCategory()),
      'category',
    )
  })
})
