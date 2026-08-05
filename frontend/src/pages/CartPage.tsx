import { Link } from 'react-router-dom'

import { CartItemRow } from '@/components/cart/CartItemRow'
import { CartSummary } from '@/components/cart/CartSummary'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FullPageSpinner } from '@/components/ui/FullPageSpinner'
import { useCart } from '@/hooks/useCart'
import { ROUTES } from '@/routes/paths'

export function CartPage() {
  const { items, totals, isHydrating, clear } = useCart()

  /*
   * Mesmo motivo do checkout: em um load completo os itens chegam depois do primeiro
   * render. Sem esta guarda, quem recarrega a página com o carrinho cheio vê o estado
   * "carrinho vazio" piscar antes dos produtos aparecerem.
   */
  if (isHydrating) {
    return <FullPageSpinner label="Carregando seu carrinho..." />
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6" data-testid="cart-page">
        <h1 className="text-ink-900 text-2xl font-bold">Carrinho</h1>
        <EmptyState
          data-testid="cart-empty"
          title="Seu carrinho está vazio"
          description="Adicione produtos ao carrinho para continuar com a compra."
          action={
            <Link
              to={ROUTES.products}
              data-testid="cart-empty-cta"
              className="bg-brand-600 hover:bg-brand-700 inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              Ver produtos
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6" data-testid="cart-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-ink-900 text-2xl font-bold">
          Carrinho{' '}
          <span data-testid="cart-line-count" className="text-ink-400 text-base font-medium">
            ({totals.lineCount} {totals.lineCount === 1 ? 'produto' : 'produtos'})
          </span>
        </h1>

        <Button variant="ghost" onClick={clear} data-testid="cart-clear">
          Esvaziar carrinho
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <ul className="flex flex-col gap-3" data-testid="cart-items">
          {items.map((item) => (
            <CartItemRow key={item.product.id} item={item} />
          ))}
        </ul>

        <CartSummary totals={totals} />
      </div>
    </div>
  )
}
