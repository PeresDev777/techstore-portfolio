import { NavLink } from 'react-router-dom'

import { useCart } from '@/hooks/useCart'
import { ROUTES } from '@/routes/paths'
import { cn } from '@/utils/cn'

/**
 * Atalho para o carrinho com contador de itens.
 *
 * O contador só é renderizado quando há itens: um badge com "0" é ruído visual. Para a
 * automação isso também é melhor — a ausência do elemento é uma asserção mais forte
 * (`toBeHidden`) do que um texto "0" que poderia aparecer por engano.
 */
export function CartIndicator() {
  const { totals } = useCart()
  const hasItems = totals.itemCount > 0

  return (
    <NavLink
      to={ROUTES.cart}
      data-testid="header-cart"
      aria-label={
        hasItems ? `Carrinho com ${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'
      }
      className={({ isActive }) =>
        cn(
          'relative flex size-10 items-center justify-center rounded-lg transition-colors',
          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-900 hover:bg-ink-400/10',
        )
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="M6 8h12l-1.1 9.1a2 2 0 0 1-2 1.9H9.1a2 2 0 0 1-2-1.9L6 8Z" />
        <path d="M9 10V6.8a3 3 0 0 1 6 0V10" />
      </svg>

      {hasItems && (
        <span
          data-testid="header-cart-count"
          className="bg-brand-600 absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white tabular-nums"
        >
          {totals.itemCount}
        </span>
      )}
    </NavLink>
  )
}
