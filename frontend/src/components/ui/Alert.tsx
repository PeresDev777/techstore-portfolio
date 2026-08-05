import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

type AlertTone = 'error' | 'success' | 'info'

interface AlertProps {
  tone?: AlertTone
  children: ReactNode
  'data-testid'?: string
}

const TONE_CLASSES: Record<AlertTone, string> = {
  error: 'bg-danger-50 text-danger-700 ring-danger-600/20',
  success: 'bg-success-50 text-success-600 ring-success-600/20',
  info: 'bg-brand-50 text-brand-700 ring-brand-600/20',
}

/**
 * Mensagem de feedback ao usuário.
 *
 * `role="alert"` faz o navegador anunciar o conteúdo assim que ele aparece — e dá à
 * automação um locator semântico (`getByRole('alert')`) que independe de estilo.
 */
export function Alert({ tone = 'info', children, 'data-testid': testId }: AlertProps) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className={cn('rounded-lg px-3.5 py-3 text-sm font-medium ring-1', TONE_CLASSES[tone])}
    >
      {children}
    </div>
  )
}
