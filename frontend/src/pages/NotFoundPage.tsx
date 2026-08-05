import { Link } from 'react-router-dom'

import { ROUTES } from '@/routes/paths'

export function NotFoundPage() {
  return (
    <main
      data-testid="not-found-page"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <span className="text-brand-600 text-5xl font-bold">404</span>
      <h1 className="text-ink-900 text-xl font-semibold">Página não encontrada</h1>
      <Link to={ROUTES.dashboard} className="text-brand-600 text-sm font-medium hover:underline">
        Voltar para o início
      </Link>
    </main>
  )
}
