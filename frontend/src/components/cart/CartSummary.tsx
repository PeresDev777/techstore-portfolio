import { Link } from 'react-router-dom'

import { FREE_SHIPPING_THRESHOLD } from '@/contexts/cartReducer'
import { ROUTES } from '@/routes/paths'
import type { CartTotals } from '@/types/cart'
import { formatCurrency } from '@/utils/format'

/**
 * Resumo do pedido.
 *
 * Cada valor expõe `data-price-cents` além do texto formatado: o teste assevera o número
 * inteiro, sem depender de "R$", separador de milhar ou locale do runner do CI.
 */
export function CartSummary({ totals }: { totals: CartTotals }) {
  const missingForFreeShipping = FREE_SHIPPING_THRESHOLD - totals.subtotal
  const hasFreeShipping = totals.shipping === 0

  return (
    <aside
      data-testid="cart-summary"
      className="rounded-card flex h-fit flex-col gap-4 bg-white p-5 ring-1 ring-black/5"
    >
      <h2 className="text-ink-900 text-base font-semibold">Resumo do pedido</h2>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">
            Subtotal ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'itens'})
          </dt>
          <dd
            data-testid="cart-subtotal"
            data-price-cents={totals.subtotal}
            className="text-ink-900 font-medium"
          >
            {formatCurrency(totals.subtotal)}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-ink-500">Frete</dt>
          <dd
            data-testid="cart-shipping"
            data-price-cents={totals.shipping}
            className={hasFreeShipping ? 'text-success-600 font-semibold' : 'text-ink-900 font-medium'}
          >
            {hasFreeShipping ? 'Grátis' : formatCurrency(totals.shipping)}
          </dd>
        </div>

        <div className="border-ink-400/20 mt-2 flex justify-between border-t pt-3">
          <dt className="text-ink-900 text-base font-semibold">Total</dt>
          <dd
            data-testid="cart-total"
            data-price-cents={totals.total}
            className="text-ink-900 text-base font-bold"
          >
            {formatCurrency(totals.total)}
          </dd>
        </div>
      </dl>

      {/* Faltando pouco para o frete grátis, vale dizer quanto — informação útil, não enfeite. */}
      {!hasFreeShipping && missingForFreeShipping > 0 && (
        <p data-testid="cart-free-shipping-hint" className="text-ink-500 text-xs">
          Faltam <strong>{formatCurrency(missingForFreeShipping)}</strong> para frete grátis.
        </p>
      )}

      <Link
        to={ROUTES.checkout}
        data-testid="cart-checkout"
        className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors"
      >
        Finalizar compra
      </Link>

      <Link
        to={ROUTES.products}
        data-testid="cart-continue-shopping"
        className="text-ink-500 hover:text-ink-900 text-center text-sm font-medium"
      >
        Continuar comprando
      </Link>
    </aside>
  )
}
