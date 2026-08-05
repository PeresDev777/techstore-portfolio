import { Link, useParams } from 'react-router-dom'

import { ProductCard } from '@/components/products/ProductCard'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Rating } from '@/components/ui/Rating'
import { useProduct } from '@/hooks/useProduct'
import { ROUTES } from '@/routes/paths'
import { formatCurrency } from '@/utils/format'

const LOW_STOCK_THRESHOLD = 5

export function ProductDetailPage() {
  // `useParams` devolve `string | undefined`: a rota pode ser montada sem o parâmetro.
  const { productId } = useParams<{ productId: string }>()
  const { product, related, isLoading, error } = useProduct(productId)

  if (isLoading) {
    return (
      <div role="status" data-testid="product-detail-loading" className="flex flex-col gap-6">
        <div className="bg-ink-400/10 h-80 animate-pulse rounded-xl" />
        <div className="bg-ink-400/10 h-6 w-1/3 animate-pulse rounded" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-start gap-4" data-testid="product-detail-error">
        <Alert tone="error">{error ?? 'Produto não encontrado.'}</Alert>
        <Link to={ROUTES.products} className="text-brand-600 text-sm font-medium hover:underline">
          ← Voltar para os produtos
        </Link>
      </div>
    )
  }

  const isOutOfStock = product.stock === 0
  const isLowStock = !isOutOfStock && product.stock <= LOW_STOCK_THRESHOLD

  return (
    <div className="flex flex-col gap-10" data-testid="product-detail-page">
      {/* Trilha de navegação: orienta o usuário e devolve um caminho de volta explícito. */}
      <nav aria-label="Você está aqui" className="text-ink-500 text-sm">
        <Link to={ROUTES.products} className="hover:text-ink-900 hover:underline">
          Produtos
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-ink-900 font-medium">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-card bg-surface-muted aspect-4/3 overflow-hidden ring-1 ring-black/5">
          <img
            src={product.imageUrl}
            alt={`${product.name} — ${product.brand}`}
            data-testid="product-detail-image"
            className="size-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" data-testid="product-detail-category">
              {product.category}
            </Badge>
            <span className="text-ink-500 text-sm">{product.brand}</span>
          </div>

          <h1 data-testid="product-detail-name" className="text-ink-900 text-3xl font-bold">
            {product.name}
          </h1>

          <Rating
            value={product.rating}
            reviewCount={product.reviewCount}
            data-testid="product-detail-rating"
          />

          <p
            data-testid="product-detail-price"
            data-price-cents={product.price}
            className="text-ink-900 text-3xl font-bold"
          >
            {formatCurrency(product.price)}
          </p>

          <p data-testid="product-detail-description" className="text-ink-700 text-sm leading-relaxed">
            {product.description}
          </p>

          <div data-testid="product-detail-stock" className="text-sm">
            {isOutOfStock ? (
              <Badge tone="danger">Produto esgotado</Badge>
            ) : isLowStock ? (
              <Badge tone="warning">Últimas {product.stock} unidades</Badge>
            ) : (
              <Badge tone="neutral">{product.stock} unidades em estoque</Badge>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="flex flex-col gap-4" data-testid="product-related">
          <h2 className="text-ink-900 text-lg font-semibold">Produtos relacionados</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
