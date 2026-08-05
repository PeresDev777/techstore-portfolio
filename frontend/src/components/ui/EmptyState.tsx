import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  'data-testid'?: string
}

/**
 * Estado vazio.
 *
 * Distinguir "nenhum resultado" de "carregando" e de "erro" é um requisito de qualidade,
 * não um detalhe visual: uma tela em branco não diz ao usuário se ele deve esperar,
 * corrigir a busca ou tentar de novo. Cada um desses estados tem seu próprio componente
 * e seu próprio cenário de teste.
 */
export function EmptyState({
  title,
  description,
  action,
  'data-testid': testId = 'empty-state',
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="border-ink-400/20 flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center"
    >
      <h2 className="text-ink-900 text-base font-semibold">{title}</h2>
      {description && <p className="text-ink-500 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
