/** Categorias do catálogo. `as const` gera a união de tipos sem custo em runtime. */
export const PRODUCT_CATEGORIES = [
  'Áudio',
  'Notebooks',
  'Smartphones',
  'Periféricos',
  'Monitores',
  'Wearables',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export interface Product {
  id: string
  slug: string
  name: string
  brand: string
  description: string
  /**
   * Preço em CENTAVOS, sempre inteiro.
   *
   * Dinheiro em ponto flutuante acumula erro: `0.1 + 0.2 === 0.30000000000000004`.
   * Em um carrinho isso vira um total errado por centavos — bug clássico e difícil de
   * rastrear. A conversão para reais acontece só na formatação, na borda da UI.
   */
  price: number
  category: ProductCategory
  /** Nota média de 0 a 5, com uma casa decimal. */
  rating: number
  reviewCount: number
  imageUrl: string
  stock: number
}

/** Opções de ordenação expostas na listagem. */
export const PRODUCT_SORT = {
  relevance: 'relevance',
  priceAsc: 'price-asc',
  priceDesc: 'price-desc',
  ratingDesc: 'rating-desc',
  nameAsc: 'name-asc',
} as const

export type ProductSort = (typeof PRODUCT_SORT)[keyof typeof PRODUCT_SORT]

export const SORT_LABELS: Record<ProductSort, string> = {
  [PRODUCT_SORT.relevance]: 'Relevância',
  [PRODUCT_SORT.priceAsc]: 'Menor preço',
  [PRODUCT_SORT.priceDesc]: 'Maior preço',
  [PRODUCT_SORT.ratingDesc]: 'Melhor avaliação',
  [PRODUCT_SORT.nameAsc]: 'Nome (A-Z)',
}

/**
 * Critérios de busca no catálogo.
 *
 * Modelado como o query string de uma API real — quando o backend existir, este objeto
 * vira os parâmetros da requisição sem que a UI mude.
 */
export interface ProductQuery {
  search?: string
  category?: ProductCategory | null
  inStockOnly?: boolean
  sort?: ProductSort
}
