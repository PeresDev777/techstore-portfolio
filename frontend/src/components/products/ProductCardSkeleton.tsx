/**
 * Placeholder exibido enquanto o catálogo carrega.
 *
 * Reserva o mesmo espaço do card real, evitando o "pulo" de layout quando os dados
 * chegam (CLS). É `aria-hidden` porque não carrega informação — quem usa leitor de tela
 * já foi avisado pelo `role="status"` da grade.
 */
export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="product-skeleton"
      className="rounded-card overflow-hidden bg-white ring-1 ring-black/5"
    >
      <div className="bg-ink-400/10 aspect-4/3 animate-pulse" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="bg-ink-400/10 h-4 w-20 animate-pulse rounded-full" />
        <div className="bg-ink-400/10 h-4 w-3/4 animate-pulse rounded" />
        <div className="bg-ink-400/10 h-3 w-24 animate-pulse rounded" />
        <div className="bg-ink-400/10 mt-2 h-6 w-28 animate-pulse rounded" />
      </div>
    </div>
  )
}
