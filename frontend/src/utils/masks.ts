/*
 * Utilitários irmãos se importam por caminho RELATIVO, e não pelo alias `@/`.
 * Motivo prático: estes módulos são cobertos por testes unitários que rodam no runner
 * nativo do Node, que não conhece o alias do bundler. Caminho relativo entre vizinhos
 * não gera acoplamento e mantém a camada testável sem ferramenta extra.
 */
export { CPF_LENGTH } from './documents.ts'

/**
 * Máscaras de exibição.
 *
 * Princípio: o ESTADO guarda apenas dígitos; a máscara existe só na renderização.
 * Misturar formatação com dado é a origem de uma classe inteira de bugs — validar
 * "123.456.789-09" exige limpar a string antes, e um CPF colado de outra fonte com
 * pontuação diferente falharia. Guardando dígitos, a validação e o envio ficam triviais
 * e a apresentação vira responsabilidade exclusiva da UI.
 */

/** Remove tudo que não for dígito e opcionalmente limita o comprimento. */
export function onlyDigits(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, '')
  return maxLength ? digits.slice(0, maxLength) : digits
}

export const CEP_LENGTH = 8
export const PHONE_MAX_LENGTH = 11

/** `12345678909` → `123.456.789-09` */
export function maskCpf(digits: string): string {
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

/** `01310100` → `01310-100` */
export function maskCep(digits: string): string {
  return digits.replace(/^(\d{5})(\d)/, '$1-$2')
}

/** `11987654321` → `(11) 98765-4321` · `1133334444` → `(11) 3333-4444` */
export function maskPhone(digits: string): string {
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }

  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
