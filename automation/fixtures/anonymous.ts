import { test as authenticatedTest } from '@fixtures/test'
import { ANONYMOUS_STATE } from '@fixtures/paths'

/**
 * Variante do `test` que começa DESLOGADA.
 *
 * A suíte roda autenticada por padrão (ver `auth.setup.ts`). Os cenários de login,
 * rota protegida e logout precisam do oposto — e precisam declarar isso de forma
 * explícita, não por efeito colateral de limpar storage no meio do teste.
 */
export const test = authenticatedTest.extend({
  storageState: ANONYMOUS_STATE,
})

export { expect } from '@playwright/test'
