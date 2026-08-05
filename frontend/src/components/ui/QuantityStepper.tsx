import { cn } from '@/utils/cn'

interface QuantityStepperProps {
  value: number
  max: number
  onChange: (quantity: number) => void
  min?: number
  'data-testid'?: string
}

/**
 * Controle de quantidade.
 *
 * Os botões ficam desabilitados nos limites em vez de aceitarem o clique e serem
 * corrigidos depois: impedir a ação inválida comunica o limite ao usuário, enquanto
 * silenciosamente ignorar o clique parece que a interface travou.
 *
 * O valor é exibido em um `<output>` e não em um `<input>` editável — digitar quantidade
 * livre exigiria validação de texto (letras, negativos, colar "1e9") sem ganho real.
 */
export function QuantityStepper({
  value,
  max,
  onChange,
  min = 1,
  'data-testid': testId,
}: QuantityStepperProps) {
  const canDecrease = value > min
  const canIncrease = value < max

  const buttonClasses =
    'flex size-8 items-center justify-center rounded-md text-base font-semibold transition-colors ' +
    'text-ink-700 hover:bg-ink-400/15 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    <div
      data-testid={testId}
      className="ring-ink-400/25 inline-flex items-center gap-1 rounded-lg bg-white p-1 ring-1"
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={!canDecrease}
        aria-label="Diminuir quantidade"
        data-testid="quantity-decrease"
        className={cn(buttonClasses)}
      >
        −
      </button>

      <output
        data-testid="quantity-value"
        aria-live="polite"
        className="text-ink-900 min-w-8 text-center text-sm font-semibold tabular-nums"
      >
        {value}
      </output>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={!canIncrease}
        aria-label="Aumentar quantidade"
        data-testid="quantity-increase"
        className={cn(buttonClasses)}
      >
        +
      </button>
    </div>
  )
}
