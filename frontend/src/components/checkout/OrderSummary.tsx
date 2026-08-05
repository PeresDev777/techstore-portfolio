import type { CartItem, CartTotals } from '@/types/cart'
import { formatCurrency } from '@/utils/format'

interface OrderSummaryProps {
  items: CartItem[]
  totals: CartTotals
  'data-testid'?: string
}

/**
 * Resumo do pedido, reutilizado no checkout e na página de sucesso.
 *
 * Um único componente para os dois lugares garante que o valor confirmado na compra e o
 * valor exibido depois sejam calculados pelo mesmo caminho — se fossem duas somas
 * independentes, poderiam divergir e o cliente veria totais diferentes para o mesmo pedido.
 */
export function OrderSummary({
  items,
  totals,
  'data-testid': testId = 'order-summary',
}: OrderSummaryProps) {
  return (
    <section
      data-testid={testId}
      className="rounded-card flex h-fit flex-col gap-4 bg-white p-5 ring-1 ring-black/5"
    >
      <h2 className="text-ink-900 text-base font-semibold">Resumo do pedido</h2>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.product.id}
            data-testid="summary-item"
            data-product-id={item.product.id}
            className="flex items-center gap-3"
          >
            <div className="bg-surface-muted size-12 shrink-0 overflow-hidden rounded-md">
              <img
                src={item.product.imageUrl}
                alt={item.product.name}
                className="size-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-ink-900 truncate text-sm font-medium">{item.product.name}</p>
              <p className="text-ink-500 text-xs">
                {item.quantity} × {formatCurrency(item.product.price)}
              </p>
            </div>

            <span
              data-testid="summary-item-total"
              data-price-cents={item.product.price * item.quantity}
              className="text-ink-900 text-sm font-semibold"
            >
              {formatCurrency(item.product.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="border-ink-400/20 flex flex-col gap-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">Subtotal</dt>
          <dd data-testid="summary-subtotal" data-price-cents={totals.subtotal}>
            {formatCurrency(totals.subtotal)}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-ink-500">Frete</dt>
          <dd
            data-testid="summary-shipping"
            data-price-cents={totals.shipping}
            className={totals.shipping === 0 ? 'text-success-600 font-semibold' : undefined}
          >
            {totals.shipping === 0 ? 'Grátis' : formatCurrency(totals.shipping)}
          </dd>
        </div>

        <div className="border-ink-400/20 mt-1 flex justify-between border-t pt-3">
          <dt className="text-ink-900 text-base font-semibold">Total</dt>
          <dd
            data-testid="summary-total"
            data-price-cents={totals.total}
            className="text-ink-900 text-base font-bold"
          >
            {formatCurrency(totals.total)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
