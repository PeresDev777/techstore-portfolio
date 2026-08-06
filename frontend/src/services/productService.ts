import { request, requestList } from '@/services/http'
import { PRODUCT_SORT, type Product, type ProductQuery } from '@/types/product'

/**
 * Serviço de catálogo.
 *
 * Busca, filtro e ordenação são do SERVIDOR — e sempre foram, na fronteira. O mock já
 * fazia esse trabalho aqui justamente para que a troca por `fetch('/products?search=...')`
 * não mudasse uma linha da UI. Foi o que aconteceu: nenhum componente ou hook precisou
 * ser tocado nesta integração.
 */

/**
 * Limite de itens na listagem.
 *
 * A aplicação não tem paginação na tela: o catálogo cabe em uma página. Pedimos o teto da
 * API (100) para preservar o comportamento atual. No dia em que o catálogo crescer, a
 * paginação já existe na API — o que falta é a UI, e o `total` devolvido por
 * `requestList` já está disponível para isso.
 */
const CATALOG_PAGE_SIZE = 100

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const { search, category, inStockOnly, sort = PRODUCT_SORT.relevance } = query

  const result = await requestList<Product>('/products', {
    query: {
      search,
      /*
       * O filtro vai como NOME de exibição ("Áudio"), que é o que a query string da UI
       * carrega. A API aceita nome ou slug de propósito — decisão tomada na Sprint 4
       * prevendo exatamente este consumidor.
       */
      category,
      // `inStock` é o nome do parâmetro na API; `inStockOnly` é o da UI. A tradução é
      // responsabilidade desta camada, não do componente.
      inStock: inStockOnly ? true : undefined,
      sort,
      limit: CATALOG_PAGE_SIZE,
    },
  })

  return result.data
}

/** Aceita id (`prd-001`) ou slug (`fone-aurora-pro`) — a API resolve os dois. */
export function getProductById(productId: string): Promise<Product> {
  return request<Product>(`/products/${encodeURIComponent(productId)}`)
}

/** Sugestões da mesma categoria, usadas na página de detalhe. */
export async function getRelatedProducts(product: Product, limit = 3): Promise<Product[]> {
  const result = await requestList<Product>(`/products/${encodeURIComponent(product.id)}/related`, {
    query: { limit },
  })

  return result.data
}
