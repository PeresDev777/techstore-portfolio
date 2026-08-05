import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { CartIndicator } from '@/components/layout/CartIndicator'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/routes/paths'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { to: ROUTES.dashboard, label: 'Início', testId: 'nav-dashboard' },
  { to: ROUTES.products, label: 'Produtos', testId: 'nav-products' },
] as const

/**
 * Cabeçalho das áreas autenticadas.
 *
 * `NavLink` (em vez de `Link`) expõe o estado ativo da rota: além do destaque visual,
 * ele marca `aria-current="page"` automaticamente — o leitor de tela e a automação
 * sabem em que seção o usuário está sem depender de classe CSS.
 */
export function Header() {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  /*
   * Encerra a sessão e não navega.
   *
   * O redirecionamento é responsabilidade do `PrivateRoute`, que reage à sessão cair.
   * Navegar aqui também criava duas navegações concorrentes para `/login` — e a que
   * vencia era imprevisível, o que fazia o `state.from` sobreviver ao logout.
   */
  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="border-ink-400/15 sticky top-0 z-10 border-b bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link
          to={ROUTES.dashboard}
          data-testid="header-logo"
          className="text-ink-900 text-lg font-bold tracking-tight"
        >
          Tech<span className="text-brand-600">Store</span>
        </Link>

        <nav aria-label="Navegação principal" className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-500 hover:text-ink-900 hover:bg-ink-400/10',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span data-testid="header-username" className="text-ink-500 hidden text-sm sm:inline">
            {user?.name}
          </span>

          <CartIndicator />

          <Button
            variant="secondary"
            onClick={() => void handleLogout()}
            isLoading={isLoggingOut}
            data-testid="header-logout"
          >
            Sair
          </Button>
        </div>
      </div>
    </header>
  )
}
