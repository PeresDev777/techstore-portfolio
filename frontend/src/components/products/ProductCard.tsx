import { Link } from 'react-router-dom'

import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Badge } from '@/components/ui/Badge'
import { Rating } from '@/components/ui/Rating'
import { productDetailPath } from '@/routes/paths'
import type { Product } from '@/types/product'
import { formatCurrency } from '@/utils/format'

/** Abaixo deste estoque, exibimos aviso de urgência. */
const LOW_STOCK_THRESHOLD = 5

export function ProductCard({ product }: { product: Product }) {
  const isOutOfStock = product.stock === 0
  const isLowStock = !isOutOfStock && product.stock <= LOW_STOCK_THRESHOLD

  return (
    <article
      data-testid="product-card"
      data-product-id={product.id}
      className="rounded-card group flex flex-col overflow-hidden bg-white ring-1 ring-black/5 transition-shadow hover:shadow-md"
    >
      <Link to={productDetailPath(product.id)} className="flex flex-1 flex-col">
        <div className="bg-surface-muted relative aspect-4/3 overflow-hidden">
          <img
            src={product.imageUrl}
            /*
             * `alt` descritivo, não "imagem do produto": é o que um leitor de tela anuncia
             * e o que permite ao teste localizar a imagem por papel semântico.
             */
            alt={`${product.name} — ${product.brand}`}
            data-testid="product-image"
            // `lazy` evita baixar as imagens fora da dobra no primeiro paint.
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {isOutOfStock && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Badge tone="danger" data-testid="product-out-of-stock">
                Esgotado
              </Badge>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <Badge data-testid="product-category">{product.category}</Badge>
            {isLowStock && (
              <Badge tone="warning" data-testid="product-low-stock">
                Últimas {product.stock}
              </Badge>
            )}
          </div>

          <h3 data-testid="product-name" className="text-ink-900 text-sm font-semibold">
            {product.name}
          </h3>

          <Rating value={product.rating} reviewCount={product.reviewCount} />

          <p
            data-testid="product-price"
            className="text-ink-900 mt-auto pt-2 text-lg font-bold"
            // Valor bruto em centavos: permite ao teste asseverar o número sem parsear "R$".
            data-price-cents={product.price}
          >
            {formatCurrency(product.price)}
          </p>
        </div>
      </Link>

      {/* Fora do <Link>: um botão dentro de âncora é HTML inválido e confunde leitores de tela. */}
      <div className="px-4 pb-4">
        <AddToCartButton product={product} fullWidth />
      </div>
    </article>
  )
}
