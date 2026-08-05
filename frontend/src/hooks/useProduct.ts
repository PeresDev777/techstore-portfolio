import { useEffect, useState } from 'react'

import { isApiError } from '@/services/apiError'
import { getProductById, getRelatedProducts } from '@/services/productService'
import type { Product } from '@/types/product'

interface UseProductResult {
  product: Product | null
  related: Product[]
  isLoading: boolean
  error: string | null
}

/** Carrega um produto e suas sugestões relacionadas para a página de detalhe. */
export function useProduct(productId: string | undefined): UseProductResult {
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    if (!productId) {
      setError('Produto não encontrado.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    async function load(id: string) {
      try {
        const found = await getProductById(id)
        if (!isCurrent) return

        setProduct(found)

        // Relacionados dependem do produto: só podem ser buscados depois, em sequência.
        const suggestions = await getRelatedProducts(found)
        if (isCurrent) setRelated(suggestions)
      } catch (caught: unknown) {
        if (!isCurrent) return
        setError(isApiError(caught) ? caught.message : 'Não foi possível carregar o produto.')
        setProduct(null)
        setRelated([])
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void load(productId)

    return () => {
      isCurrent = false
    }
  }, [productId])

  return { product, related, isLoading, error }
}
