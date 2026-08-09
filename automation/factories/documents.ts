import { fakerPT_BR as faker } from '@faker-js/faker'

/**
 * Documentos brasileiros.
 *
 * **Por que isto nao vem do Faker.** O `faker.br.cpf()` da v8 nao existe mais: o
 * `@faker-js/faker` v10 nao tem gerador de CPF em nenhum locale (verificado). E, mesmo se
 * tivesse, o problema seria o mesmo — a API valida o CPF pelo ALGORITMO DE DIGITOS
 * VERIFICADORES (ADR-013), entao onze digitos aleatorios sao recusados com 422 em ~99% das
 * vezes. Um teste de "pedido concluido com sucesso" que falha uma vez em cem por causa da
 * massa e pior que nao ter teste: ele treina o time a reexecutar em vez de investigar.
 *
 * O gerador aqui e o INVERSO da validacao da API: calcula os dois digitos em vez de
 * conferi-los.
 */

/** Digito verificador de CPF: soma ponderada decrescente, modulo 11. */
function checkDigit(digits: number[]): number {
  const weight = digits.length + 1
  const sum = digits.reduce((total, digit, index) => total + digit * (weight - index), 0)
  const remainder = (sum * 10) % 11

  /* 10 e 11 colapsam em 0 — e a regra da Receita, nao um arredondamento nosso. */
  return remainder >= 10 ? 0 : remainder
}

/**
 * CPF valido, sem mascara.
 *
 * A API aceita com ou sem pontuacao e o frontend guarda so digitos (ADR-013), entao a forma
 * canonica da massa e a de digitos puros. Quem precisa da mascara formata na hora.
 */
export function validCpf(): string {
  let base: number[]

  /*
   * Sequencias de digito repetido (111.111.111-11) passam na conta dos verificadores e
   * mesmo assim sao invalidas — a validacao as recusa explicitamente. Gerar uma aqui
   * produziria um 422 aparentemente inexplicavel, uma vez a cada dez milhoes de execucoes.
   */
  do {
    base = Array.from({ length: 9 }, () => faker.number.int({ min: 0, max: 9 }))
  } while (base.every((digit) => digit === base[0]))

  const d1 = checkDigit(base)
  const d2 = checkDigit([...base, d1])

  return [...base, d1, d2].join('')
}

/**
 * CPFs INVALIDOS, escritos a mao e nomeados pelo motivo.
 *
 * Nao sao gerados de proposito: **dado aleatorio nao acerta uma fronteira.** Cada entrada
 * aqui existe para provar um caminho especifico da validacao, e o nome do campo e o que
 * torna o teste legivel — `INVALID_CPF.repeatedDigits` diz o que esta sendo testado onde
 * `'11111111111'` nao diz nada.
 */
export const INVALID_CPF = {
  /** Digitos verificadores errados — o caso que so o algoritmo pega. */
  wrongCheckDigit: '12345678900',
  /** Passa na conta dos verificadores e ainda assim e invalido. */
  repeatedDigits: '11111111111',
  /** Curto demais. */
  tooShort: '1234567890',
  /** Com mascara e digito errado: prova que limpar a pontuacao nao basta. */
  maskedWrongCheckDigit: '123.456.789-00',
} as const

/**
 * Celular brasileiro: DDD + 9 + 8 digitos.
 *
 * O `faker.phone.number()` do locale pt-BR devolve formatos como `(40) 0169-8819` — DDD
 * inexistente e oito digitos, que a validacao de telefone do checkout recusa. Verificado.
 */
export function mobilePhone(): string {
  const areaCode = faker.helpers.arrayElement(['11', '21', '31', '41', '51', '61', '71', '81'])
  const suffix = faker.string.numeric(8)

  return `${areaCode}9${suffix}`
}

/** CEP com 8 digitos, sem mascara. */
export function zipCode(): string {
  return faker.string.numeric(8)
}

/** Unidades federativas aceitas pelo DTO da API (`@IsIn(BRAZILIAN_STATES)`). */
// prettier-ignore
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export function state(): string {
  return faker.helpers.arrayElement(BRAZILIAN_STATES)
}
