import { Contract } from '@schemas/contract'
import { test as apiTest } from '@fixtures/api'

/**
 * Fixtures dos testes de contrato.
 *
 * Estende as de API em vez de duplicar: os cenarios de contrato precisam exatamente do
 * mesmo aparato — banco limpo, clientes por papel, services — e a unica coisa nova e a
 * especificacao carregada.
 *
 * A spec tem ESCOPO DE WORKER: baixar 100 KB e compilar 35 schemas por cenario seria pagar
 * o mesmo trabalho dezenas de vezes por uma resposta que nao muda durante a execucao. O
 * escopo de worker e seguro aqui porque o `Contract` e imutavel depois de construido.
 */
export const test = apiTest.extend<object, { contract: Contract }>({
  contract: [
    async ({}, use) => {
      await use(await Contract.fromLiveApi())
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'
