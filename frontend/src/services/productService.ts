import { PRODUCTS } from '@/data/products'
import { API_ERROR_CODE, ApiError } from '@/services/apiError'
import { respondWith } from '@/services/http'
import { PRODUCT_SORT, type Product, type ProductQuery, type ProductSort } from '@/types/product'
import { normalizeForSearch } from '@/utils/text'

/**
 * Serviço de catálogo.
 *
 * Busca, filtro e ordenação acontecem AQUI, e não no componente, de propósito: em uma
 * API real esse trabalho é do servidor. Mantendo a mesma fronteira no mock, trocar por
 * `fetch('/products?search=...')` não muda uma linha da UI.
 */

/** Campos considerados na busca textual, em ordem de relevância. */
function buildSearchIndex(product: Product): string {
  return normalizeForSearch(
    [product.name, product.brand, product.category, product.description].join(' '),
  )
}

function matchesSearch(product: Product, search: string): boolean {
  const term = normalizeForSearch(search)
  if (!term) return true

  /*
   * Todos os termos precisam aparecer (AND), em qualquer ordem.
   * "fone aurora" e "aurora fone" devolvem o mesmo resultado — comportamento que o
   * usuário espera e que uma busca por substring simples não entregaria.
   */
  const index = buildSearchIndex(product)
  return term.split(/\s+/).every((word) => index.includes(word))
}

const SORT_COMPARATORS: Record<ProductSort, (a: Product, b: Product) => number> = {
  [PRODUCT_SORT.relevance]: (a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount,
  [PRODUCT_SORT.priceAsc]: (a, b) => a.price - b.price,
  [PRODUCT_SORT.priceDesc]: (a, b) => b.price - a.price,
  [PRODUCT_SORT.ratingDesc]: (a, b) => b.rating - a.rating,
  [PRODUCT_SORT.nameAsc]: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const { search = '', category = null, inStockOnly = false, sort = PRODUCT_SORT.relevance } = query

  const filtered = PRODUCTS.filter((product) => {
    if (category && product.category !== category) return false
    if (inStockOnly && product.stock === 0) return false
    return matchesSearch(product, search)
  })

  // Cópia antes de ordenar: `sort` muta o array, e `PRODUCTS` é a fonte de verdade.
  const sorted = [...filtered].sort(SORT_COMPARATORS[sort])

  return respondWith(sorted)
}

export async function getProductById(productId: string): Promise<Product> {
  const product = PRODUCTS.find((item) => item.id === productId)

  if (!product) {
    throw new ApiError(API_ERROR_CODE.NOT_FOUND, 'Produto não encontrado.')
  }

  return respondWith(product)
}

/** Sugestões da mesma categoria, usadas na página de detalhe. */
export async function getRelatedProducts(product: Product, limit = 3): Promise<Product[]> {
  const related = PRODUCTS.filter(
    (item) => item.category === product.category && item.id !== product.id,
  ).slice(0, limit)

  return respondWith(related)
}
