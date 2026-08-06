import { randomBytes } from 'node:crypto'

/**
 * Numero do pedido no formato `TS-4F2A9C`.
 *
 * Formato ja asseverado pela suite (`automation/data/customers.ts` -> `ORDER_ID_PATTERN`,
 * `/^TS-[0-9A-F]{6}\$/`). Curto o bastante para o cliente ditar por telefone, o que e
 * exatamente o proposito de um numero de pedido legivel.
 *
 * Por que nao usar o `cuid()` que ja e o padrao das outras tabelas? Porque `cmsgo3mkc0006`
 * nao se dita, nao se anota e nao se confere. O id tecnico e otimo para maquina; um pedido
 * tambem e lido por gente.
 *
 * `randomBytes` e nao `Math.random`: 3 bytes criptograficos evitam sequencias previsiveis
 * que permitiriam adivinhar numeros de pedidos alheios. A protecao real e a checagem de
 * dono na consulta, mas nao ha razao para facilitar a enumeracao.
 */
export function generateOrderNumber(): string {
  return `TS-${randomBytes(3).toString('hex').toUpperCase()}`
}

/**
 * Tentativas antes de desistir.
 *
 * Sao 16^6 = 16.777.216 combinacoes. Colisao e improvavel, mas nao impossivel — e pelo
 * paradoxo do aniversario a chance cresce muito antes do que a intuicao sugere: com ~4.800
 * pedidos ja ha cerca de 50% de probabilidade de DUAS colidirem em algum momento.
 *
 * A restricao de chave primaria garante que nunca haja dois pedidos com o mesmo numero; o
 * retry existe para que o cliente nao receba um erro por causa disso.
 */
export const ORDER_NUMBER_ATTEMPTS = 5
