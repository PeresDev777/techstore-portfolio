/**
 * Quantidade de dígitos de um CPF.
 *
 * Definida aqui, e não em `masks.ts`, porque é uma regra do documento — a máscara é
 * consumidora dessa informação, não a dona dela.
 */
export const CPF_LENGTH = 11

/**
 * Validação de CPF pelo algoritmo oficial de dígitos verificadores.
 *
 * Verificar apenas "tem 11 dígitos" aceitaria 11111111111 e qualquer número inventado —
 * exatamente o que um usuário digita para pular o formulário. O cálculo real dos dois
 * dígitos verificadores é barato e transforma o campo em uma validação de verdade,
 * gerando cenários de teste concretos (CPF válido, CPF com dígito errado, sequência
 * repetida).
 */
export function isValidCpf(digits: string): boolean {
  if (digits.length !== CPF_LENGTH) return false

  // Sequências repetidas (000..., 111...) passam no cálculo, mas são inválidas por regra.
  if (/^(\d)\1{10}$/.test(digits)) return false

  const numbers = digits.split('').map(Number)

  /**
   * Cada dígito verificador é a soma ponderada dos anteriores, com pesos decrescentes,
   * módulo 11. Resto menor que 2 significa dígito 0.
   */
  function checkDigit(length: number): number {
    let sum = 0

    for (let index = 0; index < length; index++) {
      sum += (numbers[index] ?? 0) * (length + 1 - index)
    }

    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return checkDigit(9) === numbers[9] && checkDigit(10) === numbers[10]
}
