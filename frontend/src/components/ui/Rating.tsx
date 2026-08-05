import { formatCount, formatRating } from '@/utils/format'

interface RatingProps {
  value: number
  reviewCount?: number
  'data-testid'?: string
}

const MAX_STARS = 5

/**
 * Avaliação em estrelas.
 *
 * As estrelas são decorativas (`aria-hidden`) e o valor real vai em texto acessível.
 * Um leitor de tela ouve "4,8 de 5" em vez de cinco ícones sem significado — e a
 * automação assevera o número, não a quantidade de elementos pintados.
 */
export function Rating({ value, reviewCount, 'data-testid': testId }: RatingProps) {
  const filledPercent = (Math.max(0, Math.min(value, MAX_STARS)) / MAX_STARS) * 100

  return (
    <span className="flex items-center gap-1.5" data-testid={testId}>
      <span aria-hidden="true" className="relative inline-block text-sm leading-none">
        <span className="text-ink-400/40">{'★'.repeat(MAX_STARS)}</span>
        {/* Camada preenchida recortada por largura: permite meia estrela sem ícones extras. */}
        <span
          className="absolute inset-0 overflow-hidden text-amber-500"
          style={{ width: `${filledPercent}%` }}
        >
          {'★'.repeat(MAX_STARS)}
        </span>
      </span>

      <span className="text-ink-700 text-xs font-semibold" data-testid="rating-value">
        {formatRating(value)}
      </span>

      {reviewCount !== undefined && (
        <span className="text-ink-400 text-xs">({formatCount(reviewCount)})</span>
      )}

      <span className="sr-only">
        Avaliação {formatRating(value)} de {MAX_STARS}
      </span>
    </span>
  )
}
