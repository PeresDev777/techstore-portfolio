import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SORT,
  SORT_LABELS,
  type ProductCategory,
  type ProductSort,
} from '@/types/product'

interface ProductFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  category: ProductCategory | null
  onCategoryChange: (value: string) => void
  sort: ProductSort
  onSortChange: (value: string) => void
  inStockOnly: boolean
  onInStockChange: (value: boolean) => void
  hasActiveFilters: boolean
  onClear: () => void
}

const ALL_CATEGORIES = ''

const CATEGORY_OPTIONS = [
  { value: ALL_CATEGORIES, label: 'Todas as categorias' },
  ...PRODUCT_CATEGORIES.map((category) => ({ value: category, label: category })),
]

const SORT_OPTIONS = Object.values(PRODUCT_SORT).map((sort) => ({
  value: sort,
  label: SORT_LABELS[sort],
}))

/**
 * Barra de busca, filtros e ordenação.
 *
 * Componente puramente apresentacional: recebe valores e callbacks, não guarda estado
 * nem sabe que a origem dos dados é a URL. Isso o torna reutilizável e testável em
 * isolamento — quem decide o que fazer com uma mudança é a página.
 */
export function ProductFilters({
  searchValue,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  inStockOnly,
  onInStockChange,
  hasActiveFilters,
  onClear,
}: ProductFiltersProps) {
  return (
    <section
      aria-label="Filtros de produtos"
      data-testid="product-filters"
      className="rounded-card flex flex-col gap-4 bg-white p-4 ring-1 ring-black/5"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <div className="relative">
          <Input
            label="Buscar"
            name="search"
            type="search"
            placeholder="Busque por nome, marca ou categoria"
            data-testid="product-search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              data-testid="product-search-clear"
              aria-label="Limpar busca"
              className="text-ink-400 hover:text-ink-900 absolute top-8.5 right-3 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        <Select
          label="Categoria"
          data-testid="product-category-filter"
          value={category ?? ALL_CATEGORIES}
          options={CATEGORY_OPTIONS}
          onChange={(event) => onCategoryChange(event.target.value)}
        />

        <Select
          label="Ordenar por"
          data-testid="product-sort"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(event) => onSortChange(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-ink-700 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="product-in-stock-filter"
            checked={inStockOnly}
            onChange={(event) => onInStockChange(event.target.checked)}
            className="accent-brand-600 size-4"
          />
          Somente produtos em estoque
        </label>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={onClear} data-testid="product-clear-filters">
            Limpar filtros
          </Button>
        )}
      </div>
    </section>
  )
}
