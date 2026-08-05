import { useId, type SelectHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> {
  label: string
  options: readonly SelectOption[]
}

/**
 * Select nativo com rótulo associado.
 *
 * Escolha deliberada por `<select>` nativo em vez de um dropdown customizado: teclado,
 * leitores de tela e o seletor nativo do celular funcionam de graça, e o Playwright
 * interage com ele via `selectOption` sem gambiarra.
 */
export function Select({ label, options, className, ...rest }: SelectProps) {
  const selectId = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-ink-700 text-sm font-medium">
        {label}
      </label>

      <select
        id={selectId}
        className={cn(
          'ring-ink-400/30 focus:ring-brand-600 rounded-lg bg-white px-3 py-2.5 text-sm',
          'ring-1 focus:ring-2 focus:outline-none',
          className,
        )}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
