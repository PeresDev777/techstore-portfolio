import { fakerPT_BR as faker } from '@faker-js/faker'

import { state, zipCode } from '@factories/documents'
import type { OrderAddress } from '@services/OrderService'

/**
 * Enderecos de entrega.
 *
 * Nenhuma assercao compara com estes valores — o pedido devolve o que recebeu, entao o
 * teste confere a IGUALDADE entre o enviado e o gravado, nao o conteudo. E por isso que o
 * dado pode ser gerado: a verificacao e sobre a viagem de ida e volta, nao sobre a rua.
 *
 * `state` sai da lista aceita pelo `@IsIn(BRAZILIAN_STATES)` do DTO. `faker.location.state()`
 * devolveria o nome por extenso ("Sao Paulo"), que a API recusa com 422 — o tipo de detalhe
 * que so aparece na primeira execucao vermelha.
 */
export const AddressFactory = {
  build(overrides: Partial<OrderAddress> = {}): OrderAddress {
    return {
      zipCode: zipCode(),
      street: faker.location.street(),
      number: String(faker.number.int({ min: 1, max: 4000 })),
      district: faker.location.city(),
      city: faker.location.city(),
      state: state(),
      ...overrides,
    }
  },

  /** Endereco com `complement`, que e o unico campo opcional do DTO. */
  withComplement(overrides: Partial<OrderAddress> = {}): OrderAddress {
    return AddressFactory.build({
      complement: `Apto ${faker.number.int({ min: 1, max: 200 })}`,
      ...overrides,
    })
  },
}
