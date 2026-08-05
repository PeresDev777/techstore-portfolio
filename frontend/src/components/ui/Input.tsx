import { useId, type InputHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  /** Mensagem de erro do campo. Presente = campo inválido. */
  error?: string
}

/**
 * Campo de formulário com rótulo e erro.
 *
 * Centraliza a acessibilidade que costuma ser esquecida quando cada tela monta seu
 * próprio input: `htmlFor`/`id` ligados, `aria-invalid` e `aria-describedby` apontando
 * para a mensagem de erro. Um leitor de tela — e o `getByRole` do Playwright — enxergam
 * o campo corretamente sem esforço extra em cada uso.
 */
export function Input({ label, error, className, ...rest }: InputProps) {
  // `useId` garante ids únicos mesmo com o mesmo campo renderizado duas vezes na tela.
  const inputId = useId()
  const errorId = `${inputId}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-ink-700 text-sm font-medium">
        {label}
      </label>

      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'rounded-lg bg-white px-3.5 py-2.5 text-sm ring-1 transition-shadow',
          'placeholder:text-ink-400 focus:ring-2 focus:outline-none',
          error
            ? 'ring-danger-600 focus:ring-danger-600'
            : 'ring-ink-400/30 focus:ring-brand-600',
          className,
        )}
        {...rest}
      />

      {error && (
        <span
          id={errorId}
          role="alert"
          data-testid={rest.name ? `${rest.name}-error` : undefined}
          className="text-danger-700 text-xs font-medium"
        >
          {error}
        </span>
      )}
    </div>
  )
}
