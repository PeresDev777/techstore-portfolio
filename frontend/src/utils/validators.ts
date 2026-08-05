/**
 * Validadores puros e reutilizáveis.
 *
 * Funcoes sem dependencia de React ou DOM: podem ser testadas isoladamente e
 * reaproveitadas no formulário de checkout mais adiante.
 */

/** Regra pragmática: `algo@dominio.tld`. Validação definitiva de e-mail é do servidor. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const MIN_PASSWORD_LENGTH = 6

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function isRequired(value: string): boolean {
  return value.trim().length > 0
}

/**
 * Mapa de erros por campo de um formulário.
 * Campo ausente = campo valido, o que torna `Object.keys(errors).length === 0` a
 * verificacao natural de "formulário valido".
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
