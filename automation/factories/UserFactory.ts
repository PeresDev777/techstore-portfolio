import { randomUUID } from 'node:crypto'

import { fakerPT_BR as faker } from '@faker-js/faker'

export interface NewUser {
  name: string
  email: string
  password: string
}

/**
 * Usuarios NOVOS, para cadastro.
 *
 * Este e o caso em que Faker ganha de massa fixa, e a razao e uma so: **unicidade**. A API
 * recusa e-mail duplicado com 409, entao um `novo@techstore.com` fixo funcionaria na
 * primeira execucao e falharia em todas as seguintes — a menos que a suite dependesse do
 * reset ter rodado, que e exatamente o tipo de acoplamento invisivel que produz teste
 * quebrado por ordem de execucao.
 *
 * O oposto tambem vale, e esta em `data/`: onde a assercao compara com um valor conhecido
 * (`prd-001`, preco 129990, `qa@techstore.com`), o dado e CONTRATO e nao pode ser gerado.
 *
 * **O `randomUUID` nao e paranoia.** `faker.internet.email()` sorteia de uma lista finita
 * de nomes: em algumas centenas de chamadas a colisao deixa de ser hipotetica, e o sintoma
 * seria um 409 intermitente num teste de cadastro que nao tem nada a ver com duplicidade.
 * O sufixo torna a unicidade uma garantia em vez de uma probabilidade.
 */
export const UserFactory = {
  build(overrides: Partial<NewUser> = {}): NewUser {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()

    return {
      name: `${firstName} ${lastName}`,
      email: `qa.${randomUUID()}@techstore.test`,
      /*
       * Senha fixa e valida de proposito. A regra e "minimo 8 caracteres, ao menos uma
       * letra e um numero" — gerar aleatoriamente arriscaria produzir uma senha que a
       * propria API recusa, e o teste acusaria um defeito de cadastro que na verdade seria
       * defeito da massa. Onde a regra e do sistema, o dado obedece a regra.
       */
      password: 'Novo@1234',
      ...overrides,
    }
  },

  /** Varios usuarios distintos, para cenarios de listagem administrativa. */
  buildMany(count: number, overrides: Partial<NewUser> = {}): NewUser[] {
    return Array.from({ length: count }, () => UserFactory.build(overrides))
  },
}
