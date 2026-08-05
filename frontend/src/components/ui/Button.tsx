import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

/**
 * Estender `ButtonHTMLAttributes` em vez de declarar props uma a uma faz o componente
 * aceitar `type`, `disabled`, `aria-*`, `data-testid` e handlers nativos de graca —
 * evita reimplementar a plataforma e mantem o componente aberto para extensao.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Exibe spinner e bloqueia o clique — impede submit duplicado por duplo clique. */
  isLoading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600',
  secondary: 'bg-white text-ink-700 ring-1 ring-ink-400/30 hover:bg-surface-muted',
  ghost: 'bg-transparent text-ink-500 hover:text-ink-900 hover:bg-ink-400/10',
}

export function Button({
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // `type` explícito: o default do HTML é "submit", que dispara forms sem querer.
      type="button"
      disabled={disabled ?? isLoading}
      aria-busy={isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {isLoading && (
        <span
          data-testid="button-spinner"
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
