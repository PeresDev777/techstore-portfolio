// Caminho relativo entre utils irmãos — ver a nota em `masks.ts`.
import { isValidCpf } from './documents.ts'
import { CEP_LENGTH } from './masks.ts'

/**
 * Validadores puros e reutilizáveis.
 *
 * Funções sem dependência de React ou DOM: podem ser testadas isoladamente e são
 * compartilhadas entre o login e o checkout.
 */

/** Regra pragmática: `algo@dominio.tld`. Validação definitiva de e-mail é do servidor. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const MIN_PASSWORD_LENGTH = 6
const MIN_PHONE_LENGTH = 10

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function isRequired(value: string): boolean {
  return value.trim().length > 0
}

/**
 * Mapa de erros por campo de um formulário.
 * Campo ausente = campo válido.
 */
export type FieldErrors<TFields extends string> = Partial<Record<TFields, string>>

export type LoginField = 'email' | 'password'

export function validateLoginForm(values: {
  email: string
  password: string
}): FieldErrors<LoginField> {
  const errors: FieldErrors<LoginField> = {}

  if (!isRequired(values.email)) {
    errors.email = 'Informe seu e-mail.'
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (!isRequired(values.password)) {
    errors.password = 'Informe sua senha.'
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }

  return errors
}

export type CheckoutField =
  | 'fullName'
  | 'email'
  | 'cpf'
  | 'phone'
  | 'zipCode'
  | 'street'
  | 'number'
  | 'complement'
  | 'district'
  | 'city'
  | 'state'

/**
 * Valida o formulário de checkout.
 *
 * Recebe os valores já em dígitos puros (sem máscara) — ver `utils/masks.ts`. A ordem
 * das checagens importa: "campo vazio" tem precedência sobre "campo inválido", senão o
 * usuário veria "CPF inválido" em um campo que ele simplesmente ainda não preencheu.
 */
export function validateCheckoutForm(values: Record<CheckoutField, string>) {
  const errors: FieldErrors<CheckoutField> = {}

  if (!isRequired(values.fullName)) {
    errors.fullName = 'Informe seu nome completo.'
  } else if (values.fullName.trim().split(/\s+/).length < 2) {
    errors.fullName = 'Informe nome e sobrenome.'
  }

  if (!isRequired(values.email)) {
    errors.email = 'Informe seu e-mail.'
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (!isRequired(values.cpf)) {
    errors.cpf = 'Informe seu CPF.'
  } else if (!isValidCpf(values.cpf)) {
    errors.cpf = 'CPF inválido.'
  }

  if (!isRequired(values.phone)) {
    errors.phone = 'Informe seu telefone.'
  } else if (values.phone.length < MIN_PHONE_LENGTH) {
    errors.phone = 'Telefone incompleto.'
  }

  if (!isRequired(values.zipCode)) {
    errors.zipCode = 'Informe o CEP.'
  } else if (values.zipCode.length !== CEP_LENGTH) {
    errors.zipCode = 'CEP deve ter 8 dígitos.'
  }

  if (!isRequired(values.street)) errors.street = 'Informe o endereço.'
  if (!isRequired(values.number)) errors.number = 'Informe o número.'
  if (!isRequired(values.district)) errors.district = 'Informe o bairro.'
  if (!isRequired(values.city)) errors.city = 'Informe a cidade.'
  if (!isRequired(values.state)) errors.state = 'Selecione o estado.'

  // `complement` é opcional por definição — nenhuma checagem.

  return errors
}
