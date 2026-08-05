import { useEffect, useState } from 'react'

import { ProductCard } from '@/components/products/ProductCard'
import { ProductCardSkeleton } from '@/components/products/ProductCardSkeleton'
import { ProductFilters } from '@/components/products/ProductFilters'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useProductFilters } from '@/hooks/useProductFilters'
import { useProducts } from '@/hooks/useProducts'
import { formatCount } from '@/utils/format'

const SKELETON_COUNT = 6

export function ProductsPage() {
  const { query, hasActiveFilters, setSearch, setCategory, setSort, setInStockOnly, clearFilters } =
    useProductFilters()

  /*
   * A busca tem DOIS estados de propósito:
   * - `searchInput` é local e acompanha cada tecla, para o campo responder na hora;
   * - a URL só recebe o valor após a pausa na digitação.
   *
   * Escrever direto na URL a cada tecla criaria uma navegação por caractere e
   * dispararia uma requisição por tecla.
   */
  const [searchInput, setSearchInput] = useState(query.search ?? '')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const urlSearch = query.search ?? ''

  /*
   * A guarda de igualdade não é otimização — é correção.
   *
   * `setSearchParams` do React Router é recriado a cada mudança de URL, então `setSearch`
   * muda de identidade a cada navegação e este efeito reexecuta. Sem a guarda, cada
   * interação com QUALQUER filtro dispara uma navegação extra de busca logo em seguida;
   * como a forma funcional de `setSearchParams` lê um snapshot capturado no closure, essa
   * navegação podia ser construída sobre parâmetros defasados e desfazer o filtro que o
   * usuário acabara de marcar. Sincronizar só quando os valores divergem elimina o
   * problema na origem.
   */
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      setSearch(debouncedSearch)
    }
  }, [debouncedSearch, urlSearch, setSearch])

  const { products, isLoading, error } = useProducts(query)

  function handleClearFilters() {
    setSearchInput('')
    clearFilters()
  }

  return (
    <div className="flex flex-col gap-6" data-testid="products-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-900 text-2xl font-bold">Produtos</h1>
        <p className="text-ink-500 text-sm">
          Explore o catálogo da TechStore e encontre o equipamento certo.
        </p>
      </header>

      <ProductFilters
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        category={query.category ?? null}
        onCategoryChange={setCategory}
        sort={query.sort ?? 'relevance'}
        onSortChange={setSort}
        inStockOnly={query.inStockOnly ?? false}
        onInStockChange={setInStockOnly}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
      />

      {error && (
        <Alert tone="error" data-testid="products-error">
          {error}
        </Alert>
      )}

      {/*
        Contador sempre visível quando há resultado: dá ao usuário — e ao teste — um
        número concreto para conferir contra os filtros aplicados.
      */}
      {!isLoading && !error && products.length > 0 && (
        <p className="text-ink-500 text-sm" data-testid="products-count">
          {formatCount(products.length)}{' '}
          {products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
        </p>
      )}

      {isLoading ? (
        <div
          role="status"
          aria-label="Carregando produtos"
          data-testid="products-loading"
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : products.length === 0 && !error ? (
        <EmptyState
          data-testid="products-empty"
          title="Nenhum produto encontrado"
          description="Não encontramos resultados para os filtros aplicados. Tente outro termo ou remova alguns filtros."
          action={
            hasActiveFilters && (
              <Button
                variant="secondary"
                onClick={handleClearFilters}
                data-testid="empty-clear-filters"
              >
                Limpar filtros
              </Button>
            )
          }
        />
      ) : (
        <div data-testid="products-grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
