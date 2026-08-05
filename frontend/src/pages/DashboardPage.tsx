import { Link } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/routes/paths'
import { PRODUCT_CATEGORIES } from '@/types/product'

/**
 * Área inicial pós-login.
 *
 * Funciona como ponto de partida: dá as boas-vindas e leva o usuário ao catálogo,
 * inclusive com atalhos que já entram na listagem com a categoria pré-filtrada —
 * possível porque os filtros vivem na URL.
 */
export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-8" data-testid="dashboard-page">
      <section className="flex flex-col gap-2">
        <h1 data-testid="dashboard-title" className="text-ink-900 text-2xl font-bold">
          Olá, {user?.name}
        </h1>
        <p className="text-ink-500 text-sm">
          Bem-vindo de volta à TechStore. Confira as novidades do catálogo.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink-900 text-sm font-semibold">Navegue por categoria</h2>
        <div className="flex flex-wrap gap-2" data-testid="dashboard-categories">
          {PRODUCT_CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`${ROUTES.products}?categoria=${encodeURIComponent(category)}`}
              data-testid="dashboard-category-link"
              className="text-ink-700 hover:border-brand-600 hover:text-brand-700 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium transition-colors"
            >
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Link
          to={ROUTES.products}
          data-testid="dashboard-see-all"
          className="bg-brand-600 hover:bg-brand-700 inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Ver todos os produtos
        </Link>
      </section>
    </div>
  )
}
