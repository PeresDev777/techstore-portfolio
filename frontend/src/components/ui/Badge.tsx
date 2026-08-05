import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

type BadgeTone = 'neutral' | 'brand' | 'danger' | 'warning'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-400/12 text-ink-700',
  brand: 'bg-brand-50 text-brand-700',
  danger: 'bg-danger-50 text-danger-700',
  warning: 'bg-amber-100 text-amber-800',
}

export function Badge({
  tone = 'neutral',
  children,
  'data-testid': testId,
}: {
  tone?: BadgeTone
  children: ReactNode
  'data-testid'?: string
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  )
}
