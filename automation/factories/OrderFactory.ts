import { fakerPT_BR as faker } from '@faker-js/faker'

import { AddressFactory } from '@factories/AddressFactory'
import { INVALID_CPF, mobilePhone, validCpf } from '@factories/documents'
import type { CreateOrderInput, OrderCustomer } from '@services/OrderService'

/**
 * Corpo de `POST /orders`.
 *
 * Lembrete que vale repetir porque e a regra de seguranca central da API: **o corpo nao
 * contem itens.** Eles vem do carrinho no servidor e o preco e lido do banco dentro da
 * transacao. Uma factory que montasse itens aqui estaria modelando uma API que nao existe.
 */
export const OrderFactory = {
  customer(overrides: Partial<OrderCustomer> = {}): OrderCustomer {
    return {
      fullName: `${faker.person.firstName()} ${faker.person.lastName()}`,
      email: faker.internet.email().toLowerCase(),
      cpf: validCpf(),
      phone: mobilePhone(),
      ...overrides,
    }
  },

  build(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
    return {
      customer: OrderFactory.customer(),
      address: AddressFactory.build(),
      ...overrides,
    }
  },

  /**
   * Variantes INVALIDAS, nomeadas pelo campo que deve falhar.
   *
   * Cada uma existe para asseverar um `errors[].field` especifico com caminho pontilhado —
   * `customer.cpf`, `address.state`. E o que separa "a requisicao foi recusada" de "foi
   * recusada pelo motivo certo": um DTO que passasse a exigir um campo a mais continuaria
   * devolvendo 422, e sem a verificacao do campo o teste seguiria verde contra um contrato
   * diferente.
   *
   * Escritas a mao, nunca sorteadas: dado aleatorio nao acerta uma fronteira de proposito.
   */
  invalid: {
    /** `customer.cpf` — digitos verificadores errados. */
    cpf: (): CreateOrderInput =>
      OrderFactory.build({ customer: OrderFactory.customer({ cpf: INVALID_CPF.wrongCheckDigit }) }),

    /** `customer.cpf` — sequencia repetida, que passa na conta e mesmo assim e invalida. */
    repeatedCpf: (): CreateOrderInput =>
      OrderFactory.build({ customer: OrderFactory.customer({ cpf: INVALID_CPF.repeatedDigits }) }),

    /** `customer.email` — formato invalido. */
    email: (): CreateOrderInput =>
      OrderFactory.build({ customer: OrderFactory.customer({ email: 'nao-e-email' }) }),

    /** `address.state` — fora da lista de UFs. */
    state: (): CreateOrderInput =>
      OrderFactory.build({ address: AddressFactory.build({ state: 'XX' }) }),

    /**
     * Campo aninhado AUSENTE.
     *
     * Prova que o `@Type()` do DTO esta aplicado: sem ele o objeto aninhado chega como
     * literal e o class-validator nao desce nele — a requisicao passaria com o endereco
     * pela metade e o defeito so apareceria na entrega.
     */
    missingAddressField: (): Record<string, unknown> => {
      const order = OrderFactory.build()
      const { zipCode: _omitido, ...addressSemCep } = order.address

      return { customer: order.customer, address: addressSemCep }
    },

    /**
     * Campo NAO DECLARADO no DTO — mass assignment.
     *
     * O `forbidNonWhitelisted` (ADR-024) precisa recusar. Sem ele, um campo extra viaja ate
     * a camada de dados, e e uma das escaladas de privilegio mais comuns em API REST.
     */
    extraField: (): Record<string, unknown> => ({
      ...OrderFactory.build(),
      totalInCents: 1,
      status: 'PAID',
    }),
  },
}
