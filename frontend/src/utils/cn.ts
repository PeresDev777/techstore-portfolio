/**
 * Concatena classes CSS ignorando valores falsy.
 *
 * Permite escrever `cn('base', isActive && 'ativo', error && 'erro')` sem gerar
 * "undefined" no atributo class nem encadear ternarios ilegiveis no JSX.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
