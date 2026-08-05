import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  PRODUCT_CATEGORIES,
  PRODUCT_SORT,
  type ProductCategory,
  type ProductQuery,
  type ProductSort,
} from '@/types/product'

/** Nomes dos parâmetros na URL. Em português por serem visíveis ao usuário. */
const PARAM = {
  search: 'q',
  category: 'categoria',
  sort: 'ordenar',
  inStock: 'estoque',
} as const

/**
 * Estado dos filtros mantido NA URL, não em `useState`.
 *
 * Consequências que valem o esforço:
 * - a busca vira um link compartilhável e sobrevive ao refresh;
 * - o botão "voltar" do navegador desfaz um filtro, como o usuário espera;
 * - a automação consegue montar um estado complexo navegando direto para a URL,
 *   sem precisar clicar em cada filtro para chegar lá.
 *
 * A URL é uma entrada não confiável: qualquer pessoa pode digitar `?ordenar=lixo`.
 * Por isso todo valor é validado contra o domínio antes de virar estado.
 */
function parseCategory(value: string | null): ProductCategory | null {
  if (!value) return null
  return PRODUCT_CATEGORIES.find((category) => category === value) ?? null
}

function parseSort(value: string | null): ProductSort {
  const allowed = Object.values(PRODUCT_SORT)
  return allowed.find((sort) => sort === value) ?? PRODUCT_SORT.relevance
}

export interface ProductFiltersState {
  query: ProductQuery
  hasActiveFilters: boolean
  setSearch: (value: string) => void
  setCategory: (value: string) => void
  setSort: (value: string) => void
  setInStockOnly: (value: boolean) => void
  clearFilters: () => void
}

export function useProductFilters(): ProductFiltersState {
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useMemo<Required<ProductQuery>>(
    () => ({
      search: searchParams.get(PARAM.search) ?? '',
      category: parseCategory(searchParams.get(PARAM.category)),
      sort: parseSort(searchParams.get(PARAM.sort)),
      inStockOnly: searchParams.get(PARAM.inStock) === '1',
    }),
    [searchParams],
  )

  /**
   * Escreve um parâmetro removendo-o quando vazio.
   *
   * Mantém a URL limpa (`/products` em vez de `/products?q=&categoria=`) e faz do
   * "parâmetro ausente" o único estado padrão possível — sem isso, `?q=` e a ausência de
   * `q` seriam dois estados diferentes representando a mesma coisa.
   */
  const setParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) {
            next.set(key, value)
          } else {
            next.delete(key)
          }
          return next
        },
        // `replace`: digitar na busca não deve criar uma entrada de histórico por tecla.
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  const hasActiveFilters =
    query.search !== '' || query.category !== null || query.inStockOnly || query.sort !== PRODUCT_SORT.relevance

  return {
    query,
    hasActiveFilters,
    setSearch: useCallback((value: string) => setParam(PARAM.search, value), [setParam]),
    setCategory: useCallback((value: string) => setParam(PARAM.category, value), [setParam]),
    setSort: useCallback(
      (value: string) => setParam(PARAM.sort, value === PRODUCT_SORT.relevance ? null : value),
      [setParam],
    ),
    setInStockOnly: useCallback(
      (value: boolean) => setParam(PARAM.inStock, value ? '1' : null),
      [setParam],
    ),
    clearFilters,
  }
}
