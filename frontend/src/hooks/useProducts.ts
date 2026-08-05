import { useEffect, useState } from 'react'

import { getProducts } from '@/services/productService'
import type { Product, ProductQuery } from '@/types/product'
import { isApiError } from '@/services/apiError'

interface UseProductsResult {
  products: Product[]
  isLoading: boolean
  error: string | null
}

/**
 * Busca produtos no catálogo reagindo a mudanças de filtro.
 *
 * As dependências do efeito são os campos PRIMITIVOS da query, não o objeto: um objeto
 * literal é recriado a cada render e dispararia o efeito infinitamente. Comparar por
 * valor resolve sem precisar de `useMemo` no componente que chama o hook.
 */
export function useProducts(query: ProductQuery): UseProductsResult {
  const { search, category, inStockOnly, sort } = query

  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    /*
     * Proteção contra race condition.
     *
     * Se o usuário digita "note" e depois "notebook", duas requisições ficam em voo. Nada
     * garante que respondam na ordem em que saíram — a de "note" pode chegar por último e
     * sobrescrever o resultado correto com dados obsoletos. O flag, fechado sobre este
     * efeito e desligado no cleanup, faz respostas de queries antigas serem descartadas.
     */
    let isCurrent = true

    setIsLoading(true)
    setError(null)

    getProducts({ search, category, inStockOnly, sort })
      .then((result) => {
        if (isCurrent) setProducts(result)
      })
      .catch((caught: unknown) => {
        if (!isCurrent) return
        setError(
          isApiError(caught) ? caught.message : 'Não foi possível carregar os produtos.',
        )
        setProducts([])
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [search, category, inStockOnly, sort])

  return { products, isLoading, error }
}
