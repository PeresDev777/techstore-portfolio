/**
 * Formatadores de exibição.
 *
 * `Intl` é criado uma vez fora das funções: instanciar um formatter é caro e, em uma
 * grade com dezenas de produtos, recriá-lo a cada render aparece no profiler.
 */

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const RATING_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Converte centavos (inteiro) para moeda: `129990` → `R$ 1.299,90`. */
export function formatCurrency(valueInCents: number): string {
  return CURRENCY_FORMATTER.format(valueInCents / 100)
}

/** `4.8` → `4,8` — vírgula decimal, como o usuário brasileiro espera. */
export function formatRating(rating: number): string {
  return RATING_FORMATTER.format(rating)
}

/** `1243` → `1.243` */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}
