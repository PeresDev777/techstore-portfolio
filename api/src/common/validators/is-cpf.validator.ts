import { ValidateBy, buildMessage, type ValidationOptions } from 'class-validator'

export const CPF_LENGTH = 11

/**
 * Validacao de CPF pelo algoritmo oficial de digitos verificadores.
 *
 * Replica de `frontend/src/utils/documents.ts`, e a razao de existir e a mesma: checar
 * apenas "tem 11 digitos" aceitaria `11111111111` e qualquer numero inventado — que e
 * exatamente o que se digita para furar um formulario.
 *
 * A validacao do cliente e conveniencia; a do servidor e a que vale. Uma requisicao pode
 * vir de qualquer lugar, e o CPF acaba gravado no pedido como documento fiscal.
 *
 * A suite ja tem massa para os tres casos (`automation/data/customers.ts`): CPF valido,
 * digito verificador trocado e sequencia repetida.
 */
export function isValidCpf(digits: string): boolean {
  if (digits.length !== CPF_LENGTH) return false

  // Sequencias repetidas passam no calculo, mas sao invalidas por regra.
  if (/^(\d)\1{10}$/.test(digits)) return false

  const numbers = digits.split('').map(Number)

  /**
   * Cada digito verificador e a soma ponderada dos anteriores, com pesos decrescentes,
   * modulo 11. Resto menor que 2 significa digito 0.
   */
  const checkDigit = (length: number): number => {
    let sum = 0

    for (let index = 0; index < length; index++) {
      sum += (numbers[index] ?? 0) * (length + 1 - index)
    }

    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return checkDigit(9) === numbers[9] && checkDigit(10) === numbers[10]
}

/** Decorator para usar em DTOs: `@IsCpf({ message: 'CPF inválido.' })`. */
export function IsCpf(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCpf',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidCpf(value),
        defaultMessage: buildMessage((each) => `${each}$property deve ser um CPF válido`, {
          ...validationOptions,
        }),
      },
    },
    validationOptions,
  )
}
