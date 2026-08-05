/**
 * Massa do formulário de checkout.
 *
 * Os campos são armazenados SEM máscara, como a aplicação espera receber a digitação.
 * As máscaras esperadas ficam em `EXPECTED_MASKS`, para asseverar a formatação.
 */
export interface CheckoutData {
  fullName: string
  email: string
  cpf: string
  phone: string
  zipCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

/**
 * CPFs sintaticamente válidos, gerados pelo próprio algoritmo de dígitos verificadores.
 * Não pertencem a ninguém — existem apenas como massa de teste.
 */
export const CPF = {
  valid: '11144477735',
  /** Último dígito verificador trocado. */
  invalidCheckDigit: '11144477736',
  /** Passa no cálculo, mas é inválido por regra. */
  repeatedDigits: '11111111111',
  incomplete: '111444777',
} as const

export const CUSTOMER: CheckoutData = {
  fullName: 'Gabriel Peres',
  email: 'qa@techstore.com',
  cpf: CPF.valid,
  phone: '11987654321',
  zipCode: '01310100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Sala 42',
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
}

/** Como cada campo mascarado deve aparecer na tela. */
export const EXPECTED_MASKS = {
  cpf: '111.444.777-35',
  zipCode: '01310-100',
  mobilePhone: '(11) 98765-4321',
  landlinePhone: '(11) 3333-4444',
} as const

export const CHECKOUT_MESSAGES = {
  requiredFullName: 'Informe seu nome completo.',
  missingLastName: 'Informe nome e sobrenome.',
  requiredCpf: 'Informe seu CPF.',
  invalidCpf: 'CPF inválido.',
  requiredZipCode: 'Informe o CEP.',
  incompleteZipCode: 'CEP deve ter 8 dígitos.',
  incompletePhone: 'Telefone incompleto.',
} as const

/** Formato do número do pedido: `TS-` seguido de 6 caracteres hexadecimais maiúsculos. */
export const ORDER_ID_PATTERN = /^TS-[0-9A-F]{6}$/
