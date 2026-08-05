import { Link } from 'react-router-dom'

import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { useCart } from '@/hooks/useCart'
import { productDetailPath } from '@/routes/paths'
import type { CartItem } from '@/types/cart'
import { formatCurrency } from '@/utils/format'

export function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart()
  const { product, quantity } = item

  // Total da linha calculado na renderização: nunca armazenado, nunca dessincronizado.
  const lineTotal = product.price * quantity

  return (
    <li
      data-testid="cart-item"
      data-product-id={product.id}
      className="rounded-card flex flex-col gap-4 bg-white p-4 ring-1 ring-black/5 sm:flex-row sm:items-center"
    >
      <Link
        to={productDetailPath(product.id)}
        className="bg-surface-muted size-20 shrink-0 overflow-hidden rounded-lg"
      >
        <img
          src={product.imageUrl}
          alt={`${product.name} — ${product.brand}`}
          className="size-full object-cover"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          to={productDetailPath(product.id)}
          data-testid="cart-item-name"
          className="text-ink-900 hover:text-brand-700 text-sm font-semibold"
        >
          {product.name}
        </Link>
        <span className="text-ink-500 text-xs">{product.brand}</span>
        <span
          data-testid="cart-item-unit-price"
          data-price-cents={product.price}
          className="text-ink-500 text-xs"
        >
          {formatCurrency(product.price)} cada
        </span>
      </div>

      <QuantityStepper
        value={quantity}
        max={product.stock}
        onChange={(next) => updateQuantity(product.id, next)}
        data-testid="cart-item-quantity"
      />

      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
        <span
          data-testid="cart-item-total"
          data-price-cents={lineTotal}
          className="text-ink-900 text-base font-bold"
        >
          {formatCurrency(lineTotal)}
        </span>

        <button
          type="button"
          onClick={() => removeItem(product.id)}
          data-testid="cart-item-remove"
          /*
           * O rótulo acessível inclui o nome do produto: com vários itens na tela, "Remover"
           * sozinho não diz a um leitor de tela qual deles será removido.
           */
          aria-label={`Remover ${product.name} do carrinho`}
          className="text-danger-600 hover:text-danger-700 text-xs font-semibold hover:underline"
        >
          Remover
        </button>
      </div>
    </li>
  )
}
